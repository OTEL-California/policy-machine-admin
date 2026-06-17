import React, { useState } from 'react';
import { ActionIcon, ColorPicker, Popover, Title, Tooltip } from '@mantine/core';
import { IconPalette } from '@tabler/icons-react';
import { PMIcon } from '@/components/icons/PMIcon';
import { UserMenu } from '@/features/user-menu/UserMenu';
import { Dashboard2Sidebar } from './Dashboard2Sidebar';
import { Dashboard2 } from './Dashboard2';
import { Dashboard2Panel } from './Dashboard2Panel';

export const SIDEBAR_EXPANDED_WIDTH = 220;
export const SIDEBAR_COLLAPSED_WIDTH = 50;

const CARD: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'var(--mantine-color-white)',
    borderRadius: 10,
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
};

const SWATCHES = [
    // grays
    '#e9ecef', '#dee2e6', '#ced4da', '#adb5bd',
    // warm
    '#fff3e0', '#ffe0b2', '#ffd7c2', '#f5c2c7',
    // cool blues / purples
    '#e3f2fd', '#dce8fc', '#e8eaf6', '#ede7f6',
    // greens
    '#e8f5e9', '#d4edda', '#c8f5c8', '#b2dfdb',
    // dark / dramatic
    '#343a40', '#2b2d30', '#1e1f22', '#1a1b1e',
];

export function Dashboard2Page() {
    const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(
        () => localStorage.getItem('dashboard2-sidebar-collapsed') === 'true'
    );
    const [activeId, setActiveId] = useState<string | null>(null);
    const [bgColor, setBgColor] = useState<string>('#e9ecef');

    const sidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

    const handleCollapse = (v: boolean) => {
        setSidebarCollapsed(v);
        localStorage.setItem('dashboard2-sidebar-collapsed', String(v));
    };

    const handleNavigate = (id: string) =>
        setActiveId((prev) => (prev === id ? null : id));

    return (
        <div
            style={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: bgColor,
                overflow: 'hidden',
            }}
        >
            {/* ── Header ── */}
            <div style={{ height: 48, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                <div
                    style={{
                        width: sidebarWidth,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        paddingInline: sidebarCollapsed ? 0 : 14,
                        justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                        gap: 8,
                        transition: 'width 150ms ease, padding 150ms ease',
                        overflow: 'hidden',
                    }}
                >
                    <PMIcon style={{ width: 28, height: 28, flexShrink: 0 }} />
                    {!sidebarCollapsed && (
                        <Title order={5} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            Policy Machine
                        </Title>
                    )}
                </div>

                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingInline: 16 }}>
                    <Popover position="bottom-end" withinPortal>
                        <Popover.Target>
                            <Tooltip label="Background color" position="bottom">
                                <ActionIcon variant="subtle" color="gray" size="md">
                                    <IconPalette size={18} />
                                </ActionIcon>
                            </Tooltip>
                        </Popover.Target>
                        <Popover.Dropdown p="sm">
                            <ColorPicker
                                format="hex"
                                value={bgColor}
                                onChange={setBgColor}
                                swatches={SWATCHES}
                                swatchesPerRow={4}
                            />
                        </Popover.Dropdown>
                    </Popover>

                    <UserMenu />
                </div>
            </div>

            {/* ── Body ── */}
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                <Dashboard2Sidebar
                    collapsed={sidebarCollapsed}
                    onCollapse={handleCollapse}
                    activeId={activeId}
                    onNavigate={handleNavigate}
                />

                <div
                    style={{
                        flex: 1,
                        minWidth: 0,
                        padding: '0 12px 12px 0',
                        display: 'flex',
                        gap: 12,
                    }}
                >
                    {activeId && (
                        <div style={CARD}>
                            <Dashboard2Panel activeId={activeId} onClose={() => setActiveId(null)} />
                        </div>
                    )}

                    <div style={CARD}>
                        <Dashboard2 />
                    </div>
                </div>
            </div>
        </div>
    );
}
