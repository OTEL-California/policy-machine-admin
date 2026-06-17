import React, { useMemo, useState } from 'react';
import { Group, ScrollArea, Select, Stack, Text, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { NodeIcon, getTypeColor } from '@/features/pmtree/tree-utils';
import {
    MOCK_NODES, MOCK_PCS, MockPC,
    TYPE_LABELS, TYPE_ORDER,
    sortByHierarchy, getDepthInType, getParent,
} from './mock-data';

const HOVER_BG = 'rgba(0,0,0,0.04)';

function StatChip({ type, count }: { type: string; count: number }) {
    const color = getTypeColor(type);
    return (
        <div
            style={{
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '6px 12px',
                borderRadius: 6,
                border: `1px solid var(--mantine-color-gray-3)`,
                borderTop: `3px solid ${color}`,
                minWidth: 60,
                gap: 2,
            }}
        >
            <Text size="xl" fw={700} style={{ color, lineHeight: 1 }}>{count}</Text>
            <Text size="10px" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{TYPE_LABELS[type]}</Text>
        </div>
    );
}

export function MockupC() {
    const [pc, setPc] = useState<MockPC>(MOCK_PCS[0]);
    const [search, setSearch] = useState('');
    const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());

    const nodes = MOCK_NODES[pc];

    const sortedNodes = useMemo(
        () => TYPE_ORDER.flatMap(t => sortByHierarchy(nodes.filter(n => n.type === t))),
        [nodes]
    );

    const filtered = useMemo(() => {
        return sortedNodes.filter(n => {
            const matchesSearch = !search || n.name.toLowerCase().includes(search.toLowerCase());
            const matchesType = activeTypes.size === 0 || activeTypes.has(n.type);
            return matchesSearch && matchesType;
        });
    }, [sortedNodes, search, activeTypes]);

    const counts = useMemo(() =>
        Object.fromEntries(TYPE_ORDER.map(t => [t, nodes.filter(n => n.type === t).length])),
        [nodes]
    );

    const toggleType = (type: string) =>
        setActiveTypes(prev => {
            const next = new Set(prev);
            next.has(type) ? next.delete(type) : next.add(type);
            return next;
        });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Top bar: PC selector + stat chips */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--mantine-color-gray-2)', flexShrink: 0 }}>
                <Stack gap={10}>
                    <Select
                        size="xs"
                        data={[...MOCK_PCS]}
                        value={pc}
                        onChange={v => { if (v) { setPc(v as MockPC); setSearch(''); setActiveTypes(new Set()); } }}
                        style={{ width: 180 }}
                    />
                    <Group gap={8}>
                        {TYPE_ORDER.map(t => <StatChip key={t} type={t} count={counts[t] ?? 0} />)}
                    </Group>
                </Stack>
            </div>

            {/* Search + type filter */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--mantine-color-gray-2)', flexShrink: 0 }}>
                <Group gap={8}>
                    <TextInput
                        size="xs"
                        placeholder="Search nodes…"
                        leftSection={<IconSearch size={13} />}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ flex: 1 }}
                    />
                    {TYPE_ORDER.map(type => {
                        const active = activeTypes.has(type);
                        const color = getTypeColor(type);
                        return (
                            <div
                                key={type}
                                onClick={() => toggleType(type)}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    border: `1px solid ${color}`,
                                    backgroundColor: active ? color : 'transparent',
                                    color: active ? '#fff' : color,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    transition: 'background 100ms',
                                }}
                            >
                                {type}
                            </div>
                        );
                    })}
                </Group>
            </div>

            {/* Node count */}
            <div style={{ padding: '4px 12px', flexShrink: 0 }}>
                <Text size="xs" c="dimmed">
                    {filtered.length} of {nodes.length} nodes
                </Text>
            </div>

            {/* Flat list */}
            <ScrollArea style={{ flex: 1 }}>
                {filtered.map(node => {
                    const depth = getDepthInType(node.id, nodes);
                    const parent = getParent(node, nodes);
                    const color = getTypeColor(node.type);
                    return (
                        <NodeListRow
                            key={node.id}
                            node={node}
                            depth={depth}
                            parentName={parent?.name}
                            color={color}
                        />
                    );
                })}
                {filtered.length === 0 && (
                    <Text size="sm" c="dimmed" ta="center" mt={48}>No nodes match</Text>
                )}
            </ScrollArea>
        </div>
    );
}

function NodeListRow({ node, depth, parentName, color }: {
    node: { id: string; name: string; type: string };
    depth: number;
    parentName?: string;
    color: string;
}) {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                paddingBlock: 6,
                paddingRight: 12,
                paddingLeft: 12 + depth * 14,
                borderBottom: '1px solid var(--mantine-color-gray-1)',
                backgroundColor: hovered ? HOVER_BG : 'transparent',
                cursor: 'default',
            }}
        >
            <NodeIcon type={node.type} size={15} />
            <Text size="xs" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {node.name}
            </Text>
            {parentName && (
                <Text size="xs" c="dimmed" style={{ flexShrink: 0, fontSize: 11 }}>
                    {parentName}
                </Text>
            )}
            <div style={{ width: 28, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color, border: `1px solid ${color}`, borderRadius: 3, padding: '1px 4px' }}>
                    {node.type}
                </div>
            </div>
        </div>
    );
}
