import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react';
import { atom, useAtom } from 'jotai';
import { NodeApi, NodeRendererProps, Tree, TreeApi } from 'react-arborist';
import { Alert, Button, Center, Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
    INDENT_NUM,
    NodeIcon,
    sortTreeNodes,
    transformNodeToTreeNode,
    transformNodesToTreeNodes,
    TreeNode,
} from '@/features/pmtree/tree-utils';
import { NodeType } from '@/shared/api/pdp.types';
import * as QueryService from '@/shared/api/pdp_query.api';
import { withCriticalRetry } from '@/lib/retry-utils';
import { TreeDirection, TreeFilterConfig } from './hooks/usePMTreeOperations';
import { PMNode } from './PMNode';
import { PMTreeToolbar } from './PMTreeToolbar';
import { FillFlexParent } from "./fill-flex-parent";
import "./pmtree.module.css";


export interface PMTreeClickHandlers {
    onLeftClick?: (node: TreeNode) => void;
    onRightClick?: (node: TreeNode, event: React.MouseEvent) => void;
    onDoubleClick?: (node: TreeNode) => void;
    onSelect?: (node: NodeApi<TreeNode>[]) => void;
}

export interface PMTreeProps {
    // Optional props
    rootNodes?: TreeNode[];
    direction?: TreeDirection;
    className?: string;
    style?: React.CSSProperties;
    filterConfig?: TreeFilterConfig;
    clickHandlers?: PMTreeClickHandlers;

    // Tree configuration
    disableDrag?: boolean;
    disableDrop?: boolean;
    disableEdit?: boolean;
    disableMultiSelection?: boolean;
    rowHeight?: number;
    overscanCount?: number;

    // Toolbar visibility controls
    showSelectedNodeLabel?: boolean;
    showReset?: boolean;
    showCreatePolicyClass?: boolean;
    showTreeFilters?: boolean;
    showDirection?: boolean;
    onCreatePolicyClass?: () => void;

    // Custom toolbar sections
    leftToolbarSection?: React.ReactNode;
    rightToolbarSection?: React.ReactNode;

    toolbarBg?: string;
}

function SelectedNodeLabel({ node }: { node: TreeNode | null }) {
    return (
        <div style={{ height: 24, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', borderBottom: '1px solid var(--mantine-color-default-border)' }}>
            <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>Selected Node:</Text>
            {node && (
                <Group gap={4} wrap="nowrap" style={{ minWidth: 0 }}>
                    <NodeIcon type={node.type as NodeType} size={18} style={{ flexShrink: 0 }} />
                    <Text size="sm" truncate>
                        {node.name}
                    </Text>
                </Group>
            )}
        </div>
    );
}

export function PMTree(props: PMTreeProps) {
    // Create internal atoms for this PMTree instance
    const treeApiAtom = useMemo(() => atom<TreeApi<TreeNode> | null>(null), []);
    const treeDataAtom = useMemo(() => atom<TreeNode[]>([]), []);
    const filterConfigAtom = useMemo(() => atom<TreeFilterConfig>(
        props.filterConfig || {
            nodeTypes: [NodeType.PC, NodeType.UA, NodeType.OA, NodeType.U, NodeType.O],
            showOutgoingAssociations: true,
            showIncomingAssociations: true
        }
    ), []);

    const [treeData, setTreeData] = useAtom(treeDataAtom);
    const [treeApi, setTreeApi] = useAtom(treeApiAtom);
    const [filterConfigAtomValue, setFilterConfigAtom] = useAtom(filterConfigAtom);

    const treeApiRef = useRef<TreeApi<TreeNode>>();

    // Initial data loading
    const [posNodes, setPOSNodes] = useState<TreeNode[]>([]);
    const [initialError, setInitialError] = useState<string | null>(null);

    // Selected node tracking
    const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);

    // Internal filter state
    const [internalFilters, setInternalFiltersState] = useState<TreeFilterConfig>(
        props.filterConfig || {
            nodeTypes: [NodeType.PC, NodeType.UA, NodeType.OA, NodeType.U, NodeType.O],
            showOutgoingAssociations: true,
            showIncomingAssociations: true,
        }
    );

    // Wrap setInternalFilters with immediate atom update
    const setInternalFilters = useCallback(
        (newFilters: TreeFilterConfig) => {
            setInternalFiltersState(newFilters);
            // Immediately update the filter config atom so PMNodes get the new config right away
            setFilterConfigAtom(newFilters);
        },
        [setFilterConfigAtom]
    );

    // Always use internalFilters as the active config — it is initialised from
    // props.filterConfig (see useState above) and updated by the toolbar.
    // Using props.filterConfig directly would mean external re-renders create a
    // new object reference every time, bypassing toolbar changes and causing
    // the filter effect to re-run on every parent render.
    const activeFilterConfig = internalFilters;

    // Update the filterConfig atom whenever activeFilterConfig changes
    useEffect(() => {
        setFilterConfigAtom(activeFilterConfig);
    }, [activeFilterConfig, setFilterConfigAtom]);


    const loadPOSNodes = useCallback(async () => {
        if (props.rootNodes !== undefined) return;

        setInitialError(null);

        try {
            // Only load POS if no rootNodes prop is provided
            const response = await withCriticalRetry(() => QueryService.selfComputePersonalObjectSystem());
            const treeNodes = sortTreeNodes(
                response
                    .filter(np => np.node !== undefined)
                    .map(np => ({ ...transformNodeToTreeNode(np.node!), privileges: np.accessRights }))
            );
            setPOSNodes(treeNodes);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            setInitialError(errorMessage);

            notifications.show({
                color: 'red',
                title: 'Failed to Load Policy Data',
                message: errorMessage,
                icon: <IconAlertCircle size={16} />,
                autoClose: false,
            });
        }
    }, [props.rootNodes, setTreeData]);

    useEffect(() => {
        loadPOSNodes();
    }, [loadPOSNodes]);

    // Re-filter POS root nodes whenever posNodes or activeFilterConfig changes
    useEffect(() => {
        if (props.rootNodes !== undefined) return;
        const filtered = activeFilterConfig.nodeTypes.length > 0
            ? posNodes.filter(n => activeFilterConfig.nodeTypes.includes(n.type as NodeType))
            : posNodes;
        setTreeData(filtered);
        treeApi?.closeAll();
    }, [posNodes, activeFilterConfig, props.rootNodes, setTreeData, treeApi]);

    useEffect(() => {
        if (props.rootNodes === undefined) return;

        let filteredNodes = props.rootNodes;

        if (activeFilterConfig.nodeTypes.length > 0) {
            filteredNodes = filteredNodes.filter(node =>
                activeFilterConfig.nodeTypes.includes(node.type as NodeType)
            );
        }

        filteredNodes = filteredNodes.filter(node => {
            if (!node.isAssociation) return true;
            const direction = node.associationDetails?.type;
            if (direction === 'incoming' && !activeFilterConfig.showIncomingAssociations) return false;
            if (direction === 'outgoing' && !activeFilterConfig.showOutgoingAssociations) return false;
            return true;
        });

        setTreeData(filteredNodes);
    }, [props.rootNodes, activeFilterConfig, setTreeData]);

    // Callback ref to handle TreeApi assignment
    const handleTreeApiRef = useCallback(
        (api: TreeApi<TreeNode> | null | undefined) => {
            treeApiRef.current = api as TreeApi<TreeNode> | undefined;
            if (api) {
                setTreeApi(api);
            }
        },
        [setTreeApi]
    );

    // Wrap onSelect to track selected node internally
    const handleSelect = useCallback(
        (nodes: NodeApi<TreeNode>[]) => {
            setSelectedNode(nodes.length === 1 ? nodes[0].data : null);
            props.clickHandlers?.onSelect?.(nodes);
        },
        [props.clickHandlers]
    );

    // Internal nodeRenderer that creates PMNode with proper atoms and config
    const nodeRenderer = useCallback(
        (nodeProps: NodeRendererProps<TreeNode>) => {
            return (
                <PMNode
                    {...nodeProps}
                    direction={props.direction || 'ascendants'}
                    treeDataAtom={treeDataAtom}
                    filterConfigAtom={filterConfigAtom}
                    clickHandlers={props.clickHandlers}
                />
            );
        },
        [props.direction, treeDataAtom, filterConfigAtom, props.clickHandlers]
    );

    // Determine if toolbar should be shown (if any section is visible)
    const showReset = props.showReset ?? true;
    const showCreatePolicyClass = props.showCreatePolicyClass ?? false;
    const showTreeFilters = props.showTreeFilters ?? true;
    const showDirection = props.showDirection ?? true;
    const showAnyToolbar = showReset || showCreatePolicyClass || showTreeFilters || showDirection ||
        props.leftToolbarSection || props.rightToolbarSection;

    // Reset handler - reloads data and closes all nodes
    const handleReset = useCallback(() => {
        // Reload data
        if (props.rootNodes !== undefined) {
            // If using external rootNodes, apply current filters and reset
            let filteredNodes = props.rootNodes;

            // Apply node type filter
            if (internalFilters.nodeTypes.length > 0) {
                filteredNodes = filteredNodes.filter(node =>
                    internalFilters.nodeTypes.includes(node.type as NodeType)
                );
            }

            // Apply association direction filters
            filteredNodes = filteredNodes.filter(node => {
                if (!node.isAssociation) return true;
                const direction = node.associationDetails?.type;
                if (direction === 'incoming' && !internalFilters.showIncomingAssociations) return false;
                if (direction === 'outgoing' && !internalFilters.showOutgoingAssociations) return false;
                return true;
            });

            setTreeData(filteredNodes);
        } else {
            // Reload POS nodes from server
            loadPOSNodes();
        }

        // Close all nodes in the tree
        treeApi?.closeAll();
    }, [props.rootNodes, setTreeData, loadPOSNodes, treeApi, internalFilters]);

    const internalToolbar = showAnyToolbar && (
        <PMTreeToolbar
            showReset={showReset}
            showCreatePolicyClass={showCreatePolicyClass}
            showTreeFilters={showTreeFilters}
            showDirection={showDirection}
            direction={props.direction || 'ascendants'}
            filters={internalFilters}
            onFiltersChange={setInternalFilters}
            onReset={handleReset}
            onCreatePolicyClass={props.onCreatePolicyClass}
            leftSection={props.leftToolbarSection}
            rightSection={props.rightToolbarSection}
            toolbarBg={props.toolbarBg}
        />
    );

    return (
        <>
            <div style={{
                height: '100%',
                display: "flex",
                flexDirection: "column",
            }}>
                <div style={{
                    flex: 1,
                    display: "flex",
                    minHeight: 0,
                    gap: "8px"
                }}>
                    <div style={{
                        display: "flex",
                        width: "100%",
                        flexDirection: "column",
                        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                        minWidth: 0,
                    }}>
                        {internalToolbar}
                        {(props.showSelectedNodeLabel ?? true) && <SelectedNodeLabel node={selectedNode} />}
                        <FillFlexParent>
                            {({ width, height }) => {
                                // Show error state with retry option
                                if (initialError && props.rootNodes === undefined) {
                                    return (
                                        <Center style={{ width, height }}>
                                            <Stack align="center" gap="md" maw={400}>
                                                <Alert
                                                    icon={<IconAlertCircle size={16} />}
                                                    title="Failed to Load Data"
                                                    color="red"
                                                    variant="light"
                                                >
                                                    {initialError}
                                                </Alert>
                                                <Button
                                                    leftSection={<IconRefresh size={16} />}
                                                    variant="light"
                                                    onClick={loadPOSNodes}
                                                >
                                                    Retry
                                                </Button>
                                            </Stack>
                                        </Center>
                                    );
                                }

                                return (
                                    <Tree
                                        ref={handleTreeApiRef}
                                        data={treeData}
                                        disableDrag={props.disableDrag ?? true}
                                        disableDrop={props.disableDrop ?? true}
                                        disableEdit={props.disableEdit ?? false}
                                        openByDefault={false}
                                        width={width}
                                        height={height}
                                        indent={INDENT_NUM}
                                        rowHeight={props.rowHeight ?? 28}
                                        overscanCount={props.overscanCount ?? 5}
                                        onSelect={handleSelect}
                                        disableMultiSelection={props.disableMultiSelection ?? true}
                                    >
                                        {nodeRenderer}
                                    </Tree>
                                );
                            }}
                        </FillFlexParent>
                    </div>
                </div>
            </div>
        </>
    );
}