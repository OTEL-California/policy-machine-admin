import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    IconBan,
    IconCopy,
    IconInfoSquareRounded,
    IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftCollapseFilled,
    IconLayoutSidebarLeftExpandFilled,
    IconLayoutSidebarRightCollapse,
    IconLayoutSidebarRightExpandFilled,
    IconPlus,
    IconShieldCheck,
    IconTrash,
} from '@tabler/icons-react';
import { NodeApi } from 'react-arborist';
import {
    ActionIcon,
    Button,
    Group,
    Menu,
    Modal,
    Stack,
    Text,
    TextInput,
    Tooltip,
    useMantineTheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { PMTree, TreeFilterConfig } from '@/features/pmtree';
import { OutgoingAssociationIcon, NodeIcon, TreeNode, AssociationDirection } from '@/features/pmtree/tree-utils';
import { NodeInfoPanel, RightPanelComponent, Tab, TOOLBAR_CONFIG } from '@/pages/dashboard/NodeInfoPanel';
import { OperationsPanel } from '@/pages/dashboard/OperationsPanel';
import { NodeType } from '@/shared/api/pdp.types';
import * as AdjudicationService from '@/shared/api/pdp_adjudication.api';
import * as QueryService from '@/shared/api/pdp_query.api';
import { AccessRightsTree } from '@/components/access-rights';

export function Dashboard() {
    const theme = useMantineTheme();

    // Tab state — right panel is info-only; tabs are opened dynamically via context menu
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);

    // Resize state
    const [opsWidth, setOpsWidth] = useState<number>(() => {
        const s = localStorage.getItem('dashboard-ops-width');
        return s ? parseInt(s, 10) : 320;
    });
    const [uaTreeWidth, setUaTreeWidth] = useState<number>(() => {
        const s = localStorage.getItem('dashboard-ua-tree-width');
        return s ? parseInt(s, 10) : 280;
    });
    const dragState = useRef<{ startX: number; startWidth: number } | null>(null);
    const dividerRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const uaDividerRef = useRef<HTMLDivElement>(null);
    const uaDragState = useRef<{ startX: number; startWidth: number } | null>(null);

    // Collapse state
    const [uaTreeCollapsed, setUaTreeCollapsed] = useState<boolean>(() =>
        localStorage.getItem('dashboard-ua-tree-collapsed') === 'true'
    );
    const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState<boolean>(() =>
        localStorage.getItem('dashboard-bottom-panel-collapsed') !== 'false'
    );

    // Right panel state (Operations)
    const [rightActiveComp, setRightActiveComp] = useState<RightPanelComponent | null>(() => {
        const s = localStorage.getItem('dashboard-right-active-comp');
        return (s as RightPanelComponent) || null;
    });
    const [bottomPanelHeight, setBottomPanelHeight] = useState<number>(() => {
        const s = localStorage.getItem('dashboard-bottom-panel-height');
        return s ? parseInt(s, 10) : 280;
    });
    const bottomDividerRef = useRef<HTMLDivElement>(null);
    const bottomDragState = useRef<{ startY: number; startHeight: number } | null>(null);

    // Other state
    const [contextMenuOpened, setContextMenuOpened] = useState(false);
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
    const [rightClickedNode, setRightClickedNode] = useState<TreeNode | null>(null);
    const [selectedNodes, setSelectedNodes] = useState<TreeNode[]>([]);
    const [selectedUANode, setSelectedUANode] = useState<TreeNode | null>(null);
    const [createNodeModalOpened, setCreateNodeModalOpened] = useState(false);
    const [nodeTypeToCreate, setNodeTypeToCreate] = useState<NodeType | null>(null);
    const [newNodeName, setNewNodeName] = useState('');
    const [privilegesModalOpened, setPrivilegesModalOpened] = useState(false);
    const [resourceAccessRights, setResourceAccessRights] = useState<string[]>([]);

    // Clamp panel sizes when container shrinks
    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver((entries) => {
            const { width: containerW, height: containerH } = entries[0].contentRect;
            const maxOps = containerW - 234; // leave at least 150px for left column + sidebars/dividers
            setOpsWidth((prev) => (prev > maxOps ? Math.max(200, maxOps) : prev));
            const maxBottom = containerH - 100;
            setBottomPanelHeight((prev) => Math.min(prev, Math.max(120, maxBottom)));
        });
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    const treeFilters = useMemo<TreeFilterConfig>(() => ({
        nodeTypes: [NodeType.PC, NodeType.UA, NodeType.OA, NodeType.U, NodeType.O],
        showOutgoingAssociations: false,
        showIncomingAssociations: true,
    }), []);

    const uaTreeFilters = useMemo<TreeFilterConfig>(() => ({
        nodeTypes: [NodeType.PC, NodeType.UA, NodeType.U],
        showOutgoingAssociations: false,
        showIncomingAssociations: false,
    }), []);

    // Tab management
    const openTab = useCallback((tab: Tab) => {
        setTabs((prev) => {
            const existing = prev.find((t) => t.id === tab.id);
            if (existing) return prev.map((t) => t.id === tab.id ? { ...t, ...tab } : t);
            return [...prev, tab];
        });
        setActiveTabId(tab.id);
    }, []);

    const closeTab = useCallback((tabId: string) => {
        setTabs((prev) => {
            if (prev.find((t) => t.id === tabId)?.permanent) return prev;
            const idx = prev.findIndex((t) => t.id === tabId);
            const next = prev.filter((t) => t.id !== tabId);
            setActiveTabId((cur) => {
                if (cur !== tabId) return cur;
                if (!next.length) return null;
                return next[Math.min(idx, next.length - 1)].id;
            });
            return next;
        });
    }, []);

    const switchTab = useCallback((tabId: string) => setActiveTabId(tabId), []);

    // Resize handlers (ops panel is on the right; dragging divider right shrinks it)
    const handleDividerPointerDown = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            e.preventDefault();
            dividerRef.current?.setPointerCapture(e.pointerId);
            dragState.current = { startX: e.clientX, startWidth: opsWidth };
        },
        [opsWidth]
    );

    const handleDividerPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragState.current) return;
        const containerW = containerRef.current?.offsetWidth ?? Infinity;
        const newW = Math.min(
            Math.max(200, dragState.current.startWidth - (e.clientX - dragState.current.startX)),
            containerW - 234,
        );
        setOpsWidth(newW);
    }, []);

    const handleDividerPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragState.current) return;
        const containerW = containerRef.current?.offsetWidth ?? Infinity;
        const finalW = Math.min(
            Math.max(200, dragState.current.startWidth - (e.clientX - dragState.current.startX)),
            containerW - 234,
        );
        localStorage.setItem('dashboard-ops-width', String(finalW));
        dragState.current = null;
    }, []);

    // UA tree drag handlers
    const handleUaDividerPointerDown = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            e.preventDefault();
            uaDividerRef.current?.setPointerCapture(e.pointerId);
            uaDragState.current = { startX: e.clientX, startWidth: uaTreeWidth };
        },
        [uaTreeWidth]
    );

    const handleUaDividerPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!uaDragState.current) return;
        const containerW = containerRef.current?.offsetWidth ?? Infinity;
        const newW = Math.min(
            Math.max(150, uaDragState.current.startWidth + e.clientX - uaDragState.current.startX),
            containerW - opsWidth - 234,
        );
        setUaTreeWidth(newW);
    }, [opsWidth]);

    const handleUaDividerPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!uaDragState.current) return;
        const containerW = containerRef.current?.offsetWidth ?? Infinity;
        const finalW = Math.min(
            Math.max(150, uaDragState.current.startWidth + e.clientX - uaDragState.current.startX),
            containerW - opsWidth - 234,
        );
        localStorage.setItem('dashboard-ua-tree-width', String(finalW));
        uaDragState.current = null;
    }, [opsWidth]);

    // Collapse helpers
    const collapseUaTree = useCallback(() => {
        setUaTreeCollapsed(true);
        localStorage.setItem('dashboard-ua-tree-collapsed', 'true');
    }, []);
    const expandUaTree = useCallback(() => {
        setUaTreeCollapsed(false);
        localStorage.setItem('dashboard-ua-tree-collapsed', 'false');
    }, []);
    const collapseBottom = useCallback(() => {
        setBottomPanelCollapsed(true);
        localStorage.setItem('dashboard-bottom-panel-collapsed', 'true');
    }, []);
    const expandBottom = useCallback(() => {
        setBottomPanelCollapsed(false);
        localStorage.setItem('dashboard-bottom-panel-collapsed', 'false');
    }, []);

    const toggleRightPanel = useCallback((comp: RightPanelComponent) => {
        setRightActiveComp((prev) => {
            const next = prev === comp ? null : comp;
            if (next === null) localStorage.removeItem('dashboard-right-active-comp');
            else localStorage.setItem('dashboard-right-active-comp', next);
            return next;
        });
    }, []);

    const closeRightPanel = useCallback(() => {
        setRightActiveComp(null);
        localStorage.removeItem('dashboard-right-active-comp');
    }, []);

    const handleBottomDividerPointerDown = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            e.preventDefault();
            bottomDividerRef.current?.setPointerCapture(e.pointerId);
            bottomDragState.current = { startY: e.clientY, startHeight: bottomPanelHeight };
        },
        [bottomPanelHeight]
    );

    const handleBottomDividerPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!bottomDragState.current) return;
        const delta = bottomDragState.current.startY - e.clientY;
        const containerH = containerRef.current?.offsetHeight ?? Infinity;
        setBottomPanelHeight(
            Math.min(Math.max(120, bottomDragState.current.startHeight + delta), containerH - 100)
        );
    }, []);

    const handleBottomDividerPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!bottomDragState.current) return;
        const delta = bottomDragState.current.startY - e.clientY;
        const containerH = containerRef.current?.offsetHeight ?? Infinity;
        const finalH = Math.min(Math.max(120, bottomDragState.current.startHeight + delta), containerH - 100);
        localStorage.setItem('dashboard-bottom-panel-height', String(finalH));
        bottomDragState.current = null;
    }, []);

    const handleUANodeSelect = useCallback((nodes: NodeApi<TreeNode>[]) => {
        const node = nodes?.[0]?.data ?? null;
        setSelectedUANode(node?.type === NodeType.UA ? node : null);
    }, []);

    const handleAssociateWithUANode = useCallback(() => {
        if (!rightClickedNode || !selectedUANode || rightClickedNode.pmId == null) return;
        setContextMenuOpened(false);
        if (bottomPanelCollapsed) expandBottom();
        const node = rightClickedNode;
        openTab({
            id: `node-info-${node.pmId}`,
            label: node.name,
            icon: <NodeIcon type={node.type as NodeType} size={16} />,
            component: 'NODE_INFO',
            nodeInfo: node,
            startAssociation: {
                direction: AssociationDirection.Incoming,
                otherNode: selectedUANode,
                nonce: Date.now(),
            },
        });
    }, [rightClickedNode, selectedUANode, bottomPanelCollapsed, expandBottom, openTab]);

    // Event handlers
    const handleNodeRightClick = (node: TreeNode, event: React.MouseEvent) => {
        event.preventDefault();
        if (node.isAssociation) {
            openTab({
                id: `assoc-info-${node.id}`,
                label: node.name,
                icon: <OutgoingAssociationIcon size="18" color="currentColor" />,
                component: RightPanelComponent.ASSOCIATION_INFO,
                nodeInfo: node,
            });
            return;
        }
        setRightClickedNode(node);
        setContextMenuPosition({ x: event.clientX, y: event.clientY });
        setContextMenuOpened(true);
    };

    const handleInfoClick = () => {
        if (rightClickedNode && rightClickedNode.pmId != null) {
            const node = rightClickedNode;
            const pmId = node.pmId!;
            openTab({
                id: `node-info-${pmId}`,
                label: node.name,
                icon: <NodeIcon type={node.type as NodeType} size={16} />,
                component: 'NODE_INFO',
                nodeInfo: node,
            });
            if (bottomPanelCollapsed) expandBottom();
        }
        setContextMenuOpened(false);
    };

    const handleViewPrivileges = async () => {
        setContextMenuOpened(false);
        try {
            const rights = await QueryService.getResourceAccessRights();
            setResourceAccessRights(rights);
        } catch {
            setResourceAccessRights([]);
        }
        setPrivilegesModalOpened(true);
    };

    const handleCopyNodeName = () => {
        if (rightClickedNode) {
            navigator.clipboard.writeText(rightClickedNode.name);
            notifications.show({
                title: 'Copied',
                message: `Node name "${rightClickedNode.name}" copied to clipboard`,
                color: 'green',
            });
        }
        setContextMenuOpened(false);
    };

    const handleCreateProhibitionClick = () => {
        if (rightClickedNode) {
            setSelectedNodes([rightClickedNode]);
            openTab({
                id: RightPanelComponent.CREATE_PROHIBITION,
                label: 'Create Prohibition',
                icon: <IconBan size={18} />,
                component: RightPanelComponent.CREATE_PROHIBITION,
            });
            if (bottomPanelCollapsed) expandBottom();
        }
        setContextMenuOpened(false);
    };

    const handleDeleteNode = async () => {
        if (rightClickedNode && rightClickedNode.pmId) {
            try {
                await AdjudicationService.deleteNode(rightClickedNode.pmId);
                notifications.show({
                    title: 'Node Deleted',
                    message: `Successfully deleted node "${rightClickedNode.name}"`,
                    color: 'green',
                });
            } catch (error) {
                notifications.show({
                    title: 'Delete Error',
                    message: `Failed to delete node: ${(error as Error).message}`,
                    color: 'red',
                });
            }
        }
        setContextMenuOpened(false);
    };

    const getValidChildNodeTypes = (parentType: NodeType): NodeType[] => {
        switch (parentType) {
            case NodeType.PC:
                return [NodeType.UA, NodeType.OA];
            case NodeType.UA:
                return [NodeType.UA, NodeType.U];
            case NodeType.OA:
                return [NodeType.OA, NodeType.O];
            default:
                return [];
        }
    };

    const handleCreateNodeClick = (nodeType: NodeType) => {
        setNodeTypeToCreate(nodeType);
        setNewNodeName('');
        setCreateNodeModalOpened(true);
        setContextMenuOpened(false);
    };

    const handleCreateNodeCancel = () => {
        setCreateNodeModalOpened(false);
        setNodeTypeToCreate(null);
        setNewNodeName('');
    };

    const handleCreateNodeConfirm = async () => {
        try {
            if (nodeTypeToCreate === NodeType.PC) {
                await AdjudicationService.createPolicyClass(newNodeName.trim());
            } else {
                if (!rightClickedNode || !rightClickedNode.pmId || !nodeTypeToCreate || !newNodeName.trim()) {
                    return;
                }
                switch (nodeTypeToCreate) {
                    case NodeType.UA:
                        await AdjudicationService.createUserAttribute(newNodeName.trim(), [
                            rightClickedNode.pmId,
                        ]);
                        break;
                    case NodeType.OA:
                        await AdjudicationService.createObjectAttribute(newNodeName.trim(), [
                            rightClickedNode.pmId,
                        ]);
                        break;
                    case NodeType.U:
                        await AdjudicationService.createUser(newNodeName.trim(), [rightClickedNode.pmId]);
                        break;
                    case NodeType.O:
                        await AdjudicationService.createObject(newNodeName.trim(), [rightClickedNode.pmId]);
                        break;
                }
            }
            notifications.show({
                title: 'Node Created',
                message: `Successfully created ${nodeTypeToCreate} "${newNodeName.trim()}"`,
                color: 'green',
            });
        } catch (error) {
            notifications.show({
                title: 'Create Error',
                message: `Failed to create node: ${(error as Error).message}`,
                color: 'red',
            });
        }
        handleCreateNodeCancel();
    };

    const handleSelect = (nodeApi: NodeApi<TreeNode>[]) => {
        const treeNodes = nodeApi.map((api) => api.data);
        setSelectedNodes(treeNodes);
    };

    return (
        <>
            <div
                ref={containerRef}
                style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}
            >
                {/* Vertical sidebar */}
                <div
                    style={{
                        width: 40,
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        paddingTop: 8,
                        backgroundColor: 'var(--mantine-color-gray-0)',
                        borderRight: `1px solid ${theme.other.intellijDivider as string}`,
                    }}
                >
                    <Tooltip
                        label={uaTreeCollapsed ? 'Show UA Tree' : 'Hide UA Tree'}
                        position="right"
                    >
                        <ActionIcon
                            variant="subtle"
                            onClick={uaTreeCollapsed ? expandUaTree : collapseUaTree}
                            style={{
                                width: '100%',
                                height: 44,
                                borderLeft: !uaTreeCollapsed ? `5px solid ${theme.colors[theme.primaryColor][9]}` : 'none',
                                borderRadius: 0,
                                color: 'var(--mantine-color-gray-6)',
                            }}
                        >
                            <NodeIcon type="UA" size={28} />
                            {/*<span style={{fontWeight: 700, fontSize: 20}}>UA</span>*/}
                        </ActionIcon>
                    </Tooltip>

                    {/* Bottom: info panel toggle button */}
                    <div style={{ marginTop: 'auto', paddingBottom: 40 }}>
                        <Tooltip label={bottomPanelCollapsed ? 'Show Info Panel' : 'Hide Info Panel'} position="right">
                            <ActionIcon
                                variant="subtle"
                                onClick={bottomPanelCollapsed ? expandBottom : collapseBottom}
                                style={{
                                    width: '100%',
                                    height: 44,
                                    borderLeft: !bottomPanelCollapsed ? `5px solid ${theme.colors[theme.primaryColor][9]}` : 'none',
                                    borderRadius: 0,
                                    color: 'var(--mantine-color-gray-6)',
                                }}
                            >
                                <IconInfoSquareRounded size={26} />
                            </ActionIcon>
                        </Tooltip>
                    </div>
                </div>
                {/* Column wrapper: top panels + bottom panel */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
                        {/* UA Tree panel */}
                        <div
                            style={{
                                width: uaTreeCollapsed ? 0 : uaTreeWidth,
                                flexShrink: 0,
                                height: '100%',
                                overflow: 'hidden',
                                backgroundColor: '#ffffff',
                            }}
                        >
                            <PMTree
                                style={{ width: uaTreeWidth, height: '100%' }}
                                direction="ascendants"
                                filterConfig={uaTreeFilters}
                                showTreeFilters={false}
                                showDirection={false}
                                showCreatePolicyClass={false}
                                clickHandlers={{ onSelect: handleUANodeSelect }}
                                toolbarBg="#ffffff"
                            />
                        </div>

                        {/* UA ↔ Main drag divider */}
                        {!uaTreeCollapsed && (
                            <div
                                ref={uaDividerRef}
                                onPointerDown={handleUaDividerPointerDown}
                                onPointerMove={handleUaDividerPointerMove}
                                onPointerUp={handleUaDividerPointerUp}
                                style={{
                                    width: 2,
                                    flexShrink: 0,
                                    cursor: 'col-resize',
                                    backgroundColor: theme.other.intellijDivider as string,
                                    userSelect: 'none',
                                    touchAction: 'none',
                                }}
                            />
                        )}

                        {/* Main PMTree panel */}
                        <div
                            style={{
                                flex: 1,
                                minWidth: 150,
                                height: '100%',
                                overflow: 'hidden',
                                backgroundColor: theme.other.intellijContentBg as string,
                            }}
                        >
                            <PMTree
                                style={{ width: '100%', height: '100%' }}
                                direction="ascendants"
                                filterConfig={treeFilters}
                                clickHandlers={{ onRightClick: handleNodeRightClick, onSelect: handleSelect }}
                                showCreatePolicyClass
                                onCreatePolicyClass={() => handleCreateNodeClick(NodeType.PC)}
                            />
                        </div>

                    </div>

                    {/* Bottom drag divider */}
                    {!bottomPanelCollapsed && (
                        <div
                            ref={bottomDividerRef}
                            onPointerDown={handleBottomDividerPointerDown}
                            onPointerMove={handleBottomDividerPointerMove}
                            onPointerUp={handleBottomDividerPointerUp}
                            style={{
                                height: 2,
                                flexShrink: 0,
                                cursor: 'row-resize',
                                backgroundColor: theme.other.intellijDivider as string,
                                userSelect: 'none',
                                touchAction: 'none',
                            }}
                        />
                    )}

                    {/* Bottom panel */}
                    {!bottomPanelCollapsed && (
                        <div style={{ height: bottomPanelHeight, flexShrink: 0, overflow: 'hidden', backgroundColor: 'var(--mantine-color-gray-0)' }}>
                            <NodeInfoPanel
                                tabs={tabs}
                                activeTabId={activeTabId}
                                selectedNodes={selectedNodes}
                                onTabSwitch={switchTab}
                                onTabClose={closeTab}
                            />
                        </div>
                    )}
                </div>

                {/* Left column ↔ Ops Panel drag divider */}
                {rightActiveComp !== null && (
                    <div
                        ref={dividerRef}
                        onPointerDown={handleDividerPointerDown}
                        onPointerMove={handleDividerPointerMove}
                        onPointerUp={handleDividerPointerUp}
                        style={{
                            width: 2,
                            flexShrink: 0,
                            cursor: 'col-resize',
                            backgroundColor: theme.other.intellijDivider as string,
                            userSelect: 'none',
                            touchAction: 'none',
                        }}
                    />
                )}

                {/* Operations Panel — full height */}
                {rightActiveComp !== null && (
                    <div style={{ width: opsWidth, flexShrink: 0, height: '100%', overflow: 'hidden', backgroundColor: 'var(--mantine-color-gray-0)' }}>
                        <OperationsPanel
                            activeComp={rightActiveComp}
                            selectedNodes={selectedNodes}
                            onClose={closeRightPanel}
                        />
                    </div>
                )}

                {/* Right sidebar */}
                <div
                    style={{
                        width: 40,
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        paddingTop: 8,
                        backgroundColor: 'var(--mantine-color-gray-0)',
                        borderLeft: `1px solid ${theme.other.intellijDivider as string}`,
                    }}
                >
                    {/* Feature panel toggle buttons */}
                    <div style={{display: 'flex', flexDirection: 'column', gap: 15}}>
                        {TOOLBAR_CONFIG.map((c) => {
                            const isActive = rightActiveComp === c.comp;
                            return (
                                <Tooltip key={c.comp} label={c.label} position="left">
                                    <ActionIcon
                                        variant="subtle"
                                        onClick={() => toggleRightPanel(c.comp)}
                                        style={{
                                            width: '100%',
                                            height: 44,
                                            borderRight: isActive ? `5px solid ${theme.colors[theme.primaryColor][9]}` : 'none',
                                            borderRadius: 0,
                                            color: 'var(--mantine-color-gray-6)',
                                        }}
                                        size={26}
                                    >
                                        {React.cloneElement(c.tabIcon as React.ReactElement, { size: 26 })}
                                    </ActionIcon>
                                </Tooltip>
                            );
                        })}
                    </div>
                </div>
            </div>

            <Menu
                opened={contextMenuOpened}
                onClose={() => setContextMenuOpened(false)}
                position="bottom-start"
                withArrow={false}
                shadow="md"
            >
                <Menu.Target>
                    <div
                        style={{
                            position: 'fixed',
                            left: contextMenuPosition.x,
                            top: contextMenuPosition.y,
                            width: 1,
                            height: 1,
                        }}
                    />
                </Menu.Target>
                <Menu.Dropdown>
                    <Menu.Item
                        onClick={handleInfoClick}
                        leftSection={<IconInfoSquareRounded size={16} />}
                        style={{
                            backgroundColor: `var(--mantine-color-${theme.primaryColor}-0)`,
                            borderLeft: `3px solid ${theme.colors[theme.primaryColor][6]}`,
                        }}
                    >
                        Info
                    </Menu.Item>

                    {selectedUANode &&
                        rightClickedNode &&
                        (rightClickedNode.type === NodeType.UA || rightClickedNode.type === NodeType.OA) && (
                            <Menu.Item
                                onClick={handleAssociateWithUANode}
                                leftSection={<OutgoingAssociationIcon size="16px" color={theme.colors.green[9]} />}
                                style={{
                                    backgroundColor: theme.colors.green[0],
                                    borderLeft: `3px solid ${theme.colors.green[9]}`,
                                }}
                            >
                                <Group gap={6} wrap="nowrap">
                                    Associate
                                    <NodeIcon type={selectedUANode.type as NodeType} size={16} />
                                    <Text span size="sm" fw={500}>{selectedUANode.name}</Text>
                                    with
                                    <NodeIcon type={rightClickedNode.type as NodeType} size={16} />
                                    <Text span size="sm" fw={500}>{rightClickedNode.name}</Text>
                                </Group>
                            </Menu.Item>
                        )}

                    <Menu.Item onClick={handleViewPrivileges} leftSection={<IconShieldCheck size={16} />}>
                        View Privileges
                    </Menu.Item>

                    <Menu.Item onClick={handleCopyNodeName} leftSection={<IconCopy size={16} />}>
                        Copy Node Name
                    </Menu.Item>

                    {rightClickedNode &&
                        getValidChildNodeTypes(rightClickedNode.type as NodeType).length > 0 && (
                            <>
                                <Menu.Divider />
                                <Menu.Label>Create Node</Menu.Label>
                                {getValidChildNodeTypes(rightClickedNode.type as NodeType).map((nodeType) => (
                                    <Menu.Item
                                        key={nodeType}
                                        leftSection={<NodeIcon type={nodeType} size={16} />}
                                        rightSection={<IconPlus size={16} />}
                                        onClick={() => handleCreateNodeClick(nodeType)}
                                    >
                                        Create {nodeType}
                                    </Menu.Item>
                                ))}
                            </>
                        )}

                    {rightClickedNode &&
                        (rightClickedNode.type === NodeType.U || rightClickedNode.type === NodeType.UA) && (
                            <>
                                <Menu.Divider />
                                <Menu.Label>Prohibition</Menu.Label>
                                <Menu.Item
                                    onClick={handleCreateProhibitionClick}
                                    leftSection={<IconBan size={16} />}
                                >
                                    Create Prohibition
                                </Menu.Item>
                            </>
                        )}

                    {rightClickedNode && rightClickedNode.pmId != null && (
                        <>
                            <Menu.Divider />
                            <Menu.Label>Delete</Menu.Label>
                            <Menu.Item
                                onClick={handleDeleteNode}
                                leftSection={<IconTrash size={16} />}
                                color="red"
                            >
                                Delete Node
                            </Menu.Item>
                        </>
                    )}
                </Menu.Dropdown>
            </Menu>

            <Modal
                opened={createNodeModalOpened}
                onClose={handleCreateNodeCancel}
                title={
                    <Group gap="sm">
                        <Text size="lg" fw={600}>
                            Create New Node
                        </Text>
                    </Group>
                }
                size="sm"
            >
                <Stack gap="md">
                    {rightClickedNode && nodeTypeToCreate !== NodeType.PC && (
                        <Group
                            gap="sm"
                            p="sm"
                            style={{
                                backgroundColor: 'var(--mantine-color-gray-0)',
                                borderRadius: '8px',
                                overflowX: 'auto',
                                overflowY: 'hidden',
                                minWidth: 0,
                            }}
                        >
                            <Group gap="xs" wrap="nowrap">
                                <NodeIcon
                                    type={rightClickedNode.type}
                                    size={18}
                                    style={{ flexShrink: 0 }}
                                />
                                <Text size="sm" fw={500} style={{ whiteSpace: 'nowrap' }}>
                                    {rightClickedNode.name}
                                </Text>
                            </Group>
                        </Group>
                    )}

                    <TextInput
                        label="Name"
                        placeholder="Name"
                        value={newNodeName}
                        onChange={(e) => setNewNodeName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (newNodeName.trim()) {
                                    handleCreateNodeConfirm();
                                }
                            }
                        }}
                        data-autofocus
                        required
                        leftSection={nodeTypeToCreate && <NodeIcon type={nodeTypeToCreate} size={20} />}
                    />

                    <Group justify="flex-end" gap="sm" mt="md">
                        <Button variant="outline" onClick={handleCreateNodeCancel}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateNodeConfirm} disabled={!newNodeName.trim()}>
                            Create
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            <Modal
                opened={privilegesModalOpened}
                onClose={() => setPrivilegesModalOpened(false)}
                title={
                    <Group gap="sm">
                        <IconShieldCheck size={20} />
                        <Text size="lg" fw={600}>
                            Privileges — {rightClickedNode?.name}
                        </Text>
                    </Group>
                }
            >
                <AccessRightsTree
                    availableRights={resourceAccessRights}
                    selectedRights={rightClickedNode?.privileges ?? []}
                    onChange={() => {}}
                />
            </Modal>
        </>
    );
}
