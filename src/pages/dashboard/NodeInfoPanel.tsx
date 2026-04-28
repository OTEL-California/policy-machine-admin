import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActionIcon, Menu, Tooltip, useMantineTheme } from '@mantine/core';
import { IconBan, IconCalendarCode, IconDotsVertical, IconInfoSquareRounded, IconX } from '@tabler/icons-react';
import { ProhibitionDetails, ProhibitionsPanel } from '@/features/prohibitions';
import { ObligationsPanel } from '@/features/obligations/ObligationsPanel';
import { Operations } from '@/features/operations';
import { InfoPanel } from '@/features/info/InfoPanel';
import { AssociationInfoPanel } from '@/features/info/AssociationInfoPanel';
import { AdminOperationIcon } from '@/components/icons/AdminOperationIcon';
import { ResourceOperationIcon } from '@/components/icons/ResourceOperationIcon';
import { QueryOperationIcon } from '@/components/icons/QueryOperationIcon';
import { RoutineIcon } from '@/components/icons/RoutineIcon';
import { FunctionIcon } from '@/components/icons/FunctionIcon';
import { TreeNode, AssociationDirection } from '@/features/pmtree/tree-utils';
import { WelcomePanel } from '@/features/welcome/WelcomePanel';

export enum RightPanelComponent {
    WELCOME = 'WELCOME',
    NODE_INFO = 'NODE_INFO',
    ASSOCIATION_INFO = 'ASSOCIATION_INFO',
    PROHIBITIONS = 'PROHIBITIONS',
    CREATE_PROHIBITION = 'CREATE_PROHIBITION',
    OBLIGATIONS = 'OBLIGATIONS',
    ADMIN_OPERATIONS = 'ADMIN_OPERATIONS',
    RESOURCE_OPERATIONS = 'RESOURCE_OPERATIONS',
    QUERIES = 'QUERIES',
    ROUTINES = 'ROUTINES',
    FUNCTIONS = 'FUNCTIONS',
}

export type Tab = {
    id: string;
    label: string;
    icon: React.ReactNode;
    component: RightPanelComponent | 'NODE_INFO';
    nodeInfo?: TreeNode;
    permanent?: boolean;
    startAssociation?: { direction: AssociationDirection; otherNode: TreeNode; nonce: number };
};

export type ToolbarEntry = {
    comp: RightPanelComponent;
    label: string;
    tabIcon: React.ReactNode;
    renderIcon: (active: boolean) => React.ReactNode;
};

export const TOOLBAR_CONFIG: ToolbarEntry[] = [
    {
        comp: RightPanelComponent.PROHIBITIONS,
        label: 'Prohibitions',
        tabIcon: <IconBan size={18} />,
        renderIcon: (active) => (
            <IconBan size={22} color={active ? 'white' : 'var(--mantine-primary-color-filled)'} />
        ),
    },
    {
        comp: RightPanelComponent.OBLIGATIONS,
        label: 'Obligations',
        tabIcon: <IconCalendarCode size={18} />,
        renderIcon: (active) => (
            <IconCalendarCode
                size={22}
                color={active ? 'white' : 'var(--mantine-primary-color-filled)'}
            />
        ),
    },
    {
        comp: RightPanelComponent.ADMIN_OPERATIONS,
        label: 'Admin Operations',
        tabIcon: <AdminOperationIcon size={18} />,
        renderIcon: (active) => (
            <AdminOperationIcon
                size={22}
                filled={active}
                fillColor="var(--mantine-primary-color-filled)"
            />
        ),
    },
    {
        comp: RightPanelComponent.RESOURCE_OPERATIONS,
        label: 'Resource Operations',
        tabIcon: <ResourceOperationIcon size={18} />,
        renderIcon: (active) => (
            <ResourceOperationIcon
                size={22}
                filled={active}
                fillColor="var(--mantine-primary-color-filled)"
            />
        ),
    },
    {
        comp: RightPanelComponent.QUERIES,
        label: 'Queries',
        tabIcon: <QueryOperationIcon size={18} />,
        renderIcon: (active) => (
            <QueryOperationIcon
                size={22}
                filled={active}
                fillColor="var(--mantine-primary-color-filled)"
            />
        ),
    },
    {
        comp: RightPanelComponent.ROUTINES,
        label: 'Routines',
        tabIcon: <RoutineIcon size={18} />,
        renderIcon: (active) => (
            <RoutineIcon size={22} filled={active} fillColor="var(--mantine-primary-color-filled)" />
        ),
    },
    {
        comp: RightPanelComponent.FUNCTIONS,
        label: 'Functions',
        tabIcon: <FunctionIcon size={18} />,
        renderIcon: (active) => (
            <FunctionIcon size={22} filled={active} fillColor="var(--mantine-primary-color-filled)" />
        ),
    },
];

export type RightPanelProps = {
    tabs: Tab[];
    activeTabId: string | null;
    selectedNodes: TreeNode[];
    onTabSwitch: (tabId: string) => void;
    onTabClose: (tabId: string) => void;
};

function TabItem({
                     tab,
                     isActive,
                     onSwitch,
                     onClose,
                 }: {
    tab: Tab;
    isActive: boolean;
    onSwitch: (id: string) => void;
    onClose: (id: string) => void;
}) {
    const theme = useMantineTheme();
    return (
        <Tooltip label={tab.label} position="bottom" openDelay={500} withinPortal>
            <div
                onClick={() => onSwitch(tab.id)}
                style={{
                    width: 160,
                    flexShrink: 0,
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 8,
                    paddingRight: 4,
                    gap: 4,
                    cursor: 'pointer',
                    backgroundColor: 'var(--mantine-color-gray-0)',
                    borderBottom: isActive
                        ? '2px solid var(--mantine-primary-color-filled)'
                        : '2px solid transparent',
                    borderRight: `1px solid ${theme.other.intellijDivider as string}`,
                    userSelect: 'none',
                }}
            >
                {tab.icon && (
                    <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{tab.icon}</span>
                )}
                <span
                    style={{
                        flex: 1,
                        fontSize: 13,
                        fontWeight: isActive ? 600 : 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
				{tab.label}
			</span>
                {!tab.permanent && (
                    <ActionIcon
                        size="sm"
                        variant="transparent"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose(tab.id);
                        }}
                        style={{ flexShrink: 0 }}
                    >
                        <IconX size={14} />
                    </ActionIcon>
                )}
            </div>
        </Tooltip>
    );
}

function OverflowMenu({
                          tabs,
                          activeTabId,
                          onSwitch,
                      }: {
    tabs: Tab[];
    activeTabId: string | null;
    onSwitch: (id: string) => void;
}) {
    return (
        <Menu position="bottom-end" withinPortal>
            <Menu.Target>
                <Tooltip label="More tabs" position="bottom">
                    <ActionIcon variant="transparent" size="lg" style={{ flexShrink: 0 }}>
                        <IconDotsVertical size={18} />
                    </ActionIcon>
                </Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
                {tabs.map((tab) => (
                    <Menu.Item
                        key={tab.id}
                        leftSection={tab.icon}
                        onClick={() => onSwitch(tab.id)}
                        fw={tab.id === activeTabId ? 600 : 400}
                    >
                        {tab.label}
                    </Menu.Item>
                ))}
            </Menu.Dropdown>
        </Menu>
    );
}

export function renderTabContent(
    tab: Tab,
    selectedNodes: TreeNode[],
    onClose: () => void
): React.ReactNode {
    if (tab.component === 'NODE_INFO' && tab.nodeInfo) {
        return <InfoPanel rootNode={tab.nodeInfo} onClose={onClose} startAssociation={tab.startAssociation} />;
    }
    switch (tab.component) {
        case RightPanelComponent.WELCOME:
            return <WelcomePanel />;
        case RightPanelComponent.ASSOCIATION_INFO:
            return tab.nodeInfo ? (
                <AssociationInfoPanel associationNode={tab.nodeInfo} onClose={onClose} />
            ) : null;
        case RightPanelComponent.PROHIBITIONS:
            return <ProhibitionsPanel selectedNodes={selectedNodes} />;
        case RightPanelComponent.CREATE_PROHIBITION:
            return (
                <ProhibitionDetails
                    selectedNodes={selectedNodes}
                    onCancel={onClose}
                    onSuccess={onClose}
                />
            );
        case RightPanelComponent.OBLIGATIONS:
            return <ObligationsPanel />;
        case RightPanelComponent.ADMIN_OPERATIONS:
            return <Operations initialMode="admin" />;
        case RightPanelComponent.RESOURCE_OPERATIONS:
            return <Operations initialMode="resource" />;
        case RightPanelComponent.QUERIES:
            return <Operations initialMode="query" />;
        case RightPanelComponent.ROUTINES:
            return <Operations initialMode="routine" />;
        case RightPanelComponent.FUNCTIONS:
            return <Operations initialMode="function" />;
        default:
            return null;
    }
}

export function NodeInfoPanel({
                               tabs,
                               activeTabId,
                               selectedNodes,
                               onTabSwitch,
                               onTabClose,
                           }: RightPanelProps) {
    const theme = useMantineTheme();
    const tabBarRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(600);

    useEffect(() => {
        if (!tabBarRef.current) return;
        const ro = new ResizeObserver((entries) => setContainerWidth(entries[0].contentRect.width));
        ro.observe(tabBarRef.current);
        return () => ro.disconnect();
    }, []);

    const { visibleTabs, overflowTabs } = useMemo(() => {
        const TAB_W = 160;
        const BTN_W = 32;
        const max = Math.max(1, Math.floor((containerWidth - BTN_W) / TAB_W));
        if (tabs.length <= max) return { visibleTabs: tabs, overflowTabs: [] as Tab[] };

        const activeIdx = tabs.findIndex((t) => t.id === activeTabId);
        let visible = tabs.slice(0, max);
        let overflow = tabs.slice(max);

        if (activeIdx >= max) {
            const active = tabs[activeIdx];
            overflow = [...overflow, visible[max - 1]];
            visible = [...visible.slice(0, max - 1), active];
            overflow = overflow.filter((t) => t.id !== active.id);
        }

        return { visibleTabs: visible, overflowTabs: overflow };
    }, [tabs, activeTabId, containerWidth]);

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
            }}
        >
            {/* Tab bar */}
            <div
                style={{
                    height: 42,
                    flexShrink: 0,
                    borderBottom: `1px solid ${theme.other.intellijDivider as string}`,
                    backgroundColor: 'var(--mantine-color-gray-0)',
                    display: 'flex',
                    overflow: 'hidden',
                }}
            >
                {/* Tab items */}
                <div ref={tabBarRef} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {visibleTabs.map((tab) => (
                        <TabItem
                            key={tab.id}
                            tab={tab}
                            isActive={tab.id === activeTabId}
                            onSwitch={onTabSwitch}
                            onClose={onTabClose}
                        />
                    ))}
                </div>

                {overflowTabs.length > 0 && (
                    <OverflowMenu tabs={overflowTabs} activeTabId={activeTabId} onSwitch={onTabSwitch} />
                )}
            </div>

            {/* Content panels — all mounted, only active shown */}
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                {tabs.length === 0 ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: 0.35, userSelect: 'none' }}>
                        <span style={{ fontSize: 16 }}>Right-click a node and select</span>
                        <IconInfoSquareRounded size={20} />
                        <span style={{ fontSize: 16, fontWeight: 700 }}>Info</span>
                    </div>
                ) : tabs.map((tab) => (
                    <div
                        key={tab.id}
                        style={{
                            display: tab.id === activeTabId ? 'flex' : 'none',
                            flexDirection: 'column',
                            height: '100%',
                        }}
                    >
                        {renderTabContent(tab, selectedNodes, () => onTabClose(tab.id))}
                    </div>
                ))}
            </div>
        </div>
    );
}
