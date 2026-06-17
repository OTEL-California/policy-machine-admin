import React, { useEffect, useState } from 'react';
import { ActionIcon, Group, Loader, ScrollArea, Text, Tooltip } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { PMTree, TreeFilterConfig } from '@/features/pmtree';
import { NodeIcon, TreeNode, sortTreeNodes, transformNodeToTreeNode } from '@/features/pmtree/tree-utils';
import { InfoPanel } from '@/features/info/InfoPanel';
import { NodeType, PMNode } from '@/shared/api/pdp.types';
import * as QueryService from '@/shared/api/pdp_query.api';

const DIVIDER = 'var(--mantine-color-gray-2)';

const TREE_FILTERS: TreeFilterConfig = {
    nodeTypes: [NodeType.PC, NodeType.UA, NodeType.OA, NodeType.U, NodeType.O],
    showOutgoingAssociations: false,
    showIncomingAssociations: true,
};

// ─── PC list item ─────────────────────────────────────────────────────────────

const PC_COLOR = 'var(--mantine-color-green-8)';
const PC_COLOR_ACTIVE_BG = 'var(--mantine-color-green-0)';

function PcListItem({ pc, selected, onClick }: { pc: PMNode; selected: boolean; onClick: () => void }) {
    const [hovered, setHovered] = useState(false);

    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                paddingBlock: 9,
                paddingLeft: 16,
                paddingRight: 14,
                cursor: 'pointer',
                backgroundColor: selected
                    ? PC_COLOR_ACTIVE_BG
                    : hovered
                    ? 'var(--mantine-color-gray-0)'
                    : 'transparent',
                transition: 'background 100ms',
                userSelect: 'none',
            }}
        >
            {/* Left accent bar */}
            <div
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 4,
                    bottom: 4,
                    width: 3,
                    borderRadius: 2,
                    backgroundColor: selected
                        ? PC_COLOR
                        : hovered
                        ? 'var(--mantine-color-gray-4)'
                        : 'transparent',
                    transition: 'background 100ms',
                }}
            />

            <NodeIcon type={NodeType.PC} size={20} />

            <Text
                size="sm"
                fw={selected ? 600 : 400}
                style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: selected ? PC_COLOR : 'inherit',
                    transition: 'color 100ms',
                }}
            >
                {pc.name}
            </Text>

            <IconChevronRight
                size={14}
                style={{
                    flexShrink: 0,
                    opacity: selected ? 0.7 : 0,
                    color: PC_COLOR,
                    transition: 'opacity 100ms',
                }}
            />
        </div>
    );
}

// ─── PC list panel ────────────────────────────────────────────────────────────

function PcCardList({
    selectedPc,
    onSelect,
    onCollapse,
}: {
    selectedPc: PMNode | null;
    onSelect: (pc: PMNode) => void;
    onCollapse?: () => void;
}) {
    const [pcs, setPcs] = useState<PMNode[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        QueryService.getPolicyClasses()
            .then(setPcs)
            .finally(() => setLoading(false));
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Header */}
            <div
                style={{
                    padding: '14px 16px 12px',
                    borderBottom: '1px solid var(--mantine-color-gray-2)',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                }}
            >
                <Text
                    size="xs"
                    fw={700}
                    style={{
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                        color: 'var(--mantine-color-gray-6)',
                    }}
                >
                    Policy Classes
                </Text>
                <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
                    {!loading && (
                        <div
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: 20,
                                height: 20,
                                paddingInline: 6,
                                borderRadius: 10,
                                backgroundColor: 'var(--mantine-color-gray-1)',
                                fontSize: 11,
                                fontWeight: 600,
                                color: 'var(--mantine-color-gray-6)',
                                lineHeight: 1,
                            }}
                        >
                            {pcs.length}
                        </div>
                    )}
                    {selectedPc && onCollapse && (
                        <Tooltip label="Collapse policy classes" position="bottom" withinPortal>
                            <ActionIcon variant="subtle" color="gray" size="sm" onClick={onCollapse}>
                                <IconChevronLeft size={14} />
                            </ActionIcon>
                        </Tooltip>
                    )}
                </Group>
            </div>

            {/* List */}
            <ScrollArea style={{ flex: 1 }}>
                {loading ? (
                    <Group justify="center" mt="xl"><Loader size="sm" /></Group>
                ) : pcs.length === 0 ? (
                    <Text size="xs" c="dimmed" ta="center" mt={40}>No policy classes</Text>
                ) : (
                    pcs.map(pc => (
                        <PcListItem
                            key={String(pc.id)}
                            pc={pc}
                            selected={selectedPc?.id === pc.id}
                            onClick={() => onSelect(pc)}
                        />
                    ))
                )}
            </ScrollArea>
        </div>
    );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function MockupB() {
    const [selectedPc, setSelectedPc] = useState<PMNode | null>(null);
    const [treeNode, setTreeNode] = useState<TreeNode | null>(null);
    const [rootNodes, setRootNodes] = useState<TreeNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [pcListCollapsed, setPcListCollapsed] = useState(false);

    useEffect(() => {
        if (!selectedPc) {
            setRootNodes([]);
            setTreeNode(null);
            return;
        }
        setLoading(true);
        setTreeNode(null);
        QueryService.selfComputeAdjacentAscendantPrivileges(selectedPc.id)
            .then(privileges => {
                const nodes = sortTreeNodes(
                    privileges
                        .filter(p => p.node !== undefined)
                        .map(p => ({ ...transformNodeToTreeNode(p.node!), privileges: p.accessRights }))
                );
                setRootNodes(nodes);
            })
            .finally(() => setLoading(false));
    }, [selectedPc?.id]);

    const handlePcSelect = (pc: PMNode) => {
        setSelectedPc(pc);
        setTreeNode(null);
    };

    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            {/* Level 1: PC list */}
            <div
                style={{
                    width: pcListCollapsed ? 40 : 260,
                    flexShrink: 0,
                    borderRight: `1px solid ${DIVIDER}`,
                    overflow: 'hidden',
                    transition: 'width 150ms ease',
                }}
            >
                {pcListCollapsed ? (
                    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 14 }}>
                        <Tooltip label="Expand policy classes" position="right" withinPortal>
                            <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setPcListCollapsed(false)}>
                                <IconChevronRight size={14} />
                            </ActionIcon>
                        </Tooltip>
                    </div>
                ) : (
                    <PcCardList
                        selectedPc={selectedPc}
                        onSelect={handlePcSelect}
                        onCollapse={() => setPcListCollapsed(true)}
                    />
                )}
            </div>

            {/* Level 2: PMTree for selected PC */}
            {selectedPc && (
                <div style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRight: treeNode ? `1px solid ${DIVIDER}` : undefined,
                }}>
                    {/* PC name header */}
                    <div
                        style={{
                            padding: '14px 16px 12px',
                            borderBottom: `1px solid ${DIVIDER}`,
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        <NodeIcon type={NodeType.PC} size={20} />
                        <Text fw={600} size="sm">{selectedPc.name}</Text>
                    </div>

                    {loading ? (
                        <Group justify="center" mt="xl"><Loader size="sm" /></Group>
                    ) : (
                        <PMTree
                            style={{ width: '100%', height: '100%' }}
                            direction="ascendants"
                            rootNodes={rootNodes}
                            filterConfig={TREE_FILTERS}
                            showTreeFilters={false}
                            showDirection={false}
                            showCreatePolicyClass={false}
                            showReset={false}
                            clickHandlers={{ onLeftClick: (node) => setTreeNode(node) }}
                        />
                    )}
                </div>
            )}

            {/* Level 3: node detail */}
            {treeNode && (
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <InfoPanel
                        rootNode={treeNode}
                        onClose={() => setTreeNode(null)}
                    />
                </div>
            )}
        </div>
    );
}
