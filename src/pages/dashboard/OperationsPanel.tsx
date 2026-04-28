import React from 'react';
import { ActionIcon, Text, Tooltip, useMantineTheme } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { renderTabContent, TOOLBAR_CONFIG, RightPanelComponent, Tab } from '@/pages/dashboard/NodeInfoPanel';
import { TreeNode } from '@/features/pmtree/tree-utils';

export type BottomPanelProps = {
	activeComp: RightPanelComponent;
	selectedNodes: TreeNode[];
	onClose: () => void;
};

export function OperationsPanel({ activeComp, selectedNodes, onClose }: BottomPanelProps) {
	const theme = useMantineTheme();
	const entry = TOOLBAR_CONFIG.find((c) => c.comp === activeComp);

	const tab: Tab = {
		id: activeComp,
		label: entry?.label ?? activeComp,
		icon: entry?.tabIcon,
		component: activeComp,
		permanent: true,
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
			{/* Content */}
			<div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
				{renderTabContent(tab, selectedNodes, onClose)}
			</div>
		</div>
	);
}
