import React, { useState } from 'react';
import { Tooltip } from '@mantine/core';
import { IconBan, IconCalendarCode, IconChevronDown, IconChevronLeft, IconChevronRight, IconChevronUp, IconHelp } from '@tabler/icons-react';
import { AdminOperationIcon } from '@/components/icons/AdminOperationIcon';
import { ResourceOperationIcon } from '@/components/icons/ResourceOperationIcon';
import { QueryOperationIcon } from '@/components/icons/QueryOperationIcon';
import { RoutineIcon } from '@/components/icons/RoutineIcon';
import { FunctionIcon } from '@/components/icons/FunctionIcon';
import { NodeIcon } from '@/features/pmtree/tree-utils';
import { NodeType } from '@/shared/api/pdp.types';

// ─── Nav config ────────────────────────────────────────────────────────────────
// Edit NAV_SECTIONS to customize the sidebar menu.
// renderIcon receives `active` so the icon can reflect selection state.

export type NavChild = {
    id: string;
    label: string;
};

export type NavSection = {
    id: string;
    label: string;
    renderIcon: () => React.ReactNode;
    children?: NavChild[];
};

export const NAV_SECTIONS: NavSection[] = [
    {
        id: 'prohibitions',
        label: 'Prohibitions',
        renderIcon: () => <IconBan size={18} />,
    },
    {
        id: 'obligations',
        label: 'Obligations',
        renderIcon: () => <IconCalendarCode size={18} />,
    },
    {
        id: 'admin-operations',
        label: 'Admin Operations',
        renderIcon: () => <AdminOperationIcon size={18} />,
    },
    {
        id: 'resource-operations',
        label: 'Resource Operations',
        renderIcon: () => <ResourceOperationIcon size={18} />,
    },
    {
        id: 'queries',
        label: 'Queries',
        renderIcon: () => <QueryOperationIcon size={18} />,
    },
    {
        id: 'routines',
        label: 'Routines',
        renderIcon: () => <RoutineIcon size={18} />,
    },
    {
        id: 'functions',
        label: 'Functions',
        renderIcon: () => <FunctionIcon size={18} />,
    },
];

// ─── Hover helpers ─────────────────────────────────────────────────────────────

const HOVER_BG = 'rgba(0,0,0,0.07)';

function setHover(el: HTMLDivElement, on: boolean, active: boolean) {
    if (!active) el.style.backgroundColor = on ? HOVER_BG : 'transparent';
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
    collapsed: boolean;
    onCollapse: (v: boolean) => void;
    activeId: string | null;
    onNavigate: (id: string) => void;
};

export function Dashboard2Sidebar({ collapsed, onCollapse, activeId, onNavigate }: Props) {
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string) =>
        setExpandedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    const isActive = (id: string) => activeId === id || (activeId?.startsWith(id + '.') ?? false);

    return (
        <div
            style={{
                width: collapsed ? 50 : 220,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'transparent',
                transition: 'width 150ms ease',
                overflow: 'hidden',
            }}
        >
            {/* Nav items */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingTop: 8 }}>
                <Tooltip label="User Attributes" position="right" disabled={!collapsed} withinPortal>
                    <div
                        onClick={() => onNavigate('ua-tree')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            gap: 10,
                            paddingBlock: 7,
                            paddingInline: collapsed ? 0 : 12,
                            cursor: 'pointer',
                            borderRadius: 6,
                            ...(collapsed
                                ? { width: 34, margin: '1px auto' }
                                : { marginInline: 4, marginBlock: 1 }),
                            backgroundColor: activeId === 'ua-tree' ? 'rgba(0,0,0,0.12)' : 'transparent',
                            fontWeight: activeId === 'ua-tree' ? 600 : 400,
                            fontSize: 13,
                            whiteSpace: 'nowrap',
                            userSelect: 'none',
                            transition: 'background 100ms',
                        }}
                        onMouseEnter={(e) => setHover(e.currentTarget as HTMLDivElement, true, activeId === 'ua-tree')}
                        onMouseLeave={(e) => setHover(e.currentTarget as HTMLDivElement, false, activeId === 'ua-tree')}
                    >
                        <span style={{ flexShrink: 0, display: 'flex' }}>
                            <NodeIcon type={NodeType.UA} size={18} style={{ color: 'currentColor', border: '2px solid currentColor' }} />
                        </span>
                        {!collapsed && <span>User Attributes</span>}
                    </div>
                </Tooltip>

                {NAV_SECTIONS.map((section) => {
                    const active = isActive(section.id);
                    const expanded = expandedIds.has(section.id);

                    return (
                        <React.Fragment key={section.id}>
                            <Tooltip
                                label={section.label}
                                position="right"
                                disabled={!collapsed}
                                withinPortal
                            >
                                <div
                                    onClick={() => {
                                        if (section.children) toggleExpand(section.id);
                                        else onNavigate(section.id);
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: collapsed ? 'center' : 'flex-start',
                                        gap: 10,
                                        paddingBlock: 7,
                                        paddingInline: collapsed ? 0 : 12,
                                        cursor: 'pointer',
                                        borderRadius: 6,
                                        // When collapsed: fixed-width pill centered in the 50px column.
                                        // When expanded: full-width item with side margins.
                                        ...(collapsed
                                            ? { width: 34, margin: '1px auto' }
                                            : { marginInline: 4, marginBlock: 1 }),
                                        backgroundColor: active ? 'rgba(0,0,0,0.12)' : 'transparent',
                                        fontWeight: active ? 600 : 400,
                                        fontSize: 13,
                                        whiteSpace: 'nowrap',
                                        userSelect: 'none',
                                        transition: 'background 100ms',
                                    }}
                                    onMouseEnter={(e) => setHover(e.currentTarget as HTMLDivElement, true, active)}
                                    onMouseLeave={(e) => setHover(e.currentTarget as HTMLDivElement, false, active)}
                                >
                                    <span style={{ flexShrink: 0, display: 'flex' }}>
                                        {section.renderIcon()}
                                    </span>
                                    {!collapsed && (
                                        <>
                                            <span style={{ flex: 1 }}>{section.label}</span>
                                            {section.children && (
                                                <span style={{ flexShrink: 0, opacity: 0.5 }}>
                                                    {expanded
                                                        ? <IconChevronUp size={14} />
                                                        : <IconChevronDown size={14} />}
                                                </span>
                                            )}
                                        </>
                                    )}
                                </div>
                            </Tooltip>

                            {/* Sub-items */}
                            {!collapsed && section.children && expanded &&
                                section.children.map((child) => {
                                    const childActive = activeId === child.id;
                                    return (
                                        <div
                                            key={child.id}
                                            onClick={() => onNavigate(child.id)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                paddingBlock: 6,
                                                paddingLeft: 40,
                                                paddingRight: 12,
                                                cursor: 'pointer',
                                                borderRadius: 6,
                                                marginInline: 4,
                                                marginBlock: 1,
                                                fontSize: 13,
                                                backgroundColor: childActive ? 'rgba(0,0,0,0.12)' : 'transparent',
                                                fontWeight: childActive ? 600 : 400,
                                                whiteSpace: 'nowrap',
                                                userSelect: 'none',
                                            }}
                                            onMouseEnter={(e) => setHover(e.currentTarget as HTMLDivElement, true, childActive)}
                                            onMouseLeave={(e) => setHover(e.currentTarget as HTMLDivElement, false, childActive)}
                                        >
                                            {child.label}
                                        </div>
                                    );
                                })}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Bottom actions */}
            <div
                style={{
                    paddingBlock: 8,
                    paddingInline: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                }}
            >
                <Tooltip label="Help" position="right" disabled={!collapsed} withinPortal>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            gap: 10,
                            paddingBlock: 7,
                            paddingInline: collapsed ? 0 : 8,
                            cursor: 'pointer',
                            borderRadius: 6,
                            fontSize: 13,
                            whiteSpace: 'nowrap',
                            userSelect: 'none',
                            ...(collapsed
                                ? { width: 34, margin: '1px auto' }
                                : { marginInline: 4 }),
                        }}
                        onMouseEnter={(e) => setHover(e.currentTarget as HTMLDivElement, true, false)}
                        onMouseLeave={(e) => setHover(e.currentTarget as HTMLDivElement, false, false)}
                    >
                        <span style={{ flexShrink: 0, display: 'flex' }}>
                            <IconHelp size={18} />
                        </span>
                        {!collapsed && <span>Help</span>}
                    </div>
                </Tooltip>

                <Tooltip
                    label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    position="right"
                    withinPortal
                >
                    <div
                        onClick={() => onCollapse(!collapsed)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            gap: 10,
                            paddingBlock: 7,
                            paddingInline: collapsed ? 0 : 8,
                            cursor: 'pointer',
                            borderRadius: 6,
                            fontSize: 13,
                            whiteSpace: 'nowrap',
                            userSelect: 'none',
                            ...(collapsed
                                ? { width: 34, margin: '1px auto' }
                                : { marginInline: 4 }),
                        }}
                        onMouseEnter={(e) => setHover(e.currentTarget as HTMLDivElement, true, false)}
                        onMouseLeave={(e) => setHover(e.currentTarget as HTMLDivElement, false, false)}
                    >
                        <span style={{ flexShrink: 0, display: 'flex' }}>
                            {collapsed ? <IconChevronRight size={18} /> : <IconChevronLeft size={18} />}
                        </span>
                        {!collapsed && <span>Collapse sidebar</span>}
                    </div>
                </Tooltip>
            </div>
        </div>
    );
}
