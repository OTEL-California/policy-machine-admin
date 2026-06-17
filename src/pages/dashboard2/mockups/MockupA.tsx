import React, { useState } from 'react';
import { ScrollArea, Select, Text } from '@mantine/core';
import { NodeIcon, getTypeColor } from '@/features/pmtree/tree-utils';
import {
    MOCK_NODES, MOCK_PCS, MockPC, MockNode,
    TYPE_LABELS, TYPE_ORDER,
    sortByHierarchy, getDepthInType,
} from './mock-data';

const HOVER_BG = 'rgba(0,0,0,0.04)';

function NodeRow({ node, depth }: { node: MockNode; depth: number }) {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                paddingBlock: 5,
                paddingRight: 8,
                paddingLeft: 8 + depth * 14,
                borderRadius: 4,
                cursor: 'default',
                backgroundColor: hovered ? HOVER_BG : 'transparent',
                transition: 'background 80ms',
            }}
        >
            <NodeIcon type={node.type} size={13} />
            <Text size="xs" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {node.name}
            </Text>
        </div>
    );
}

export function MockupA() {
    const [pc, setPc] = useState<MockPC>(MOCK_PCS[0]);
    const nodes = MOCK_NODES[pc];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--mantine-color-gray-2)', flexShrink: 0 }}>
                <Select
                    size="xs"
                    data={[...MOCK_PCS]}
                    value={pc}
                    onChange={v => v && setPc(v as MockPC)}
                    style={{ width: 180 }}
                />
            </div>

            {/* Columns */}
            <div style={{ flex: 1, display: 'flex', minHeight: 0, overflowX: 'auto' }}>
                {TYPE_ORDER.map((type, i) => {
                    const color = getTypeColor(type);
                    const typeNodes = sortByHierarchy(nodes.filter(n => n.type === type));

                    return (
                        <div
                            key={type}
                            style={{
                                flex: 1,
                                minWidth: 130,
                                display: 'flex',
                                flexDirection: 'column',
                                borderLeft: i > 0 ? '1px solid var(--mantine-color-gray-2)' : 'none',
                            }}
                        >
                            {/* Column header */}
                            <div
                                style={{
                                    padding: '8px 10px 6px',
                                    borderBottom: `2px solid ${color}`,
                                    flexShrink: 0,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <NodeIcon type={type} size={14} />
                                    <Text size="xs" fw={600} style={{ color, flex: 1, whiteSpace: 'nowrap' }}>
                                        {TYPE_LABELS[type]}
                                    </Text>
                                    <Text size="xs" c="dimmed">{typeNodes.length}</Text>
                                </div>
                            </div>

                            {/* Node list */}
                            <ScrollArea style={{ flex: 1 }} p={4}>
                                {typeNodes.length === 0 ? (
                                    <Text size="xs" c="dimmed" ta="center" mt="md">None</Text>
                                ) : (
                                    typeNodes.map(node => (
                                        <NodeRow
                                            key={node.id}
                                            node={node}
                                            depth={getDepthInType(node.id, nodes)}
                                        />
                                    ))
                                )}
                            </ScrollArea>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
