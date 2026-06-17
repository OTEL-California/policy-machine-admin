import React, { useState, useEffect } from "react";
import {
	IconPoint,
	IconSquareRoundedMinus, IconSquareRoundedPlus
} from "@tabler/icons-react";
import clsx from "clsx";
import {NodeRendererProps} from "react-arborist";
import {ActionIcon, Loader, useMantineTheme, Tooltip} from "@mantine/core";
import classes from "@/features/pmtree/pmtree.module.css";
import { PMTreeClickHandlers } from "./PMTree";
import { TreeDirection, usePMTreeOperations, TreeFilterConfig } from "./hooks/usePMTreeOperations";
import { PrimitiveAtom } from "jotai/index";
import { useAtom } from "jotai";
import { useTheme } from "@/shared/theme/ThemeContext";
import {
	INDENT_NUM,
	NodeIcon,
	IncomingAssociationIcon,
	OutgoingAssociationIcon,
	shouldShowExpansionIcon,
	truncateMiddle, TreeNode
} from "@/features/pmtree/tree-utils";
import * as QueryService from "@/shared/api/pdp_query.api";

// Module-level cache so PC memberships are only fetched once per session per node.
const pcCache = new Map<string, string[]>();

// BFS up the ascendant graph until PC nodes are found (up to 8 hops).
async function fetchPCsForNode(pmId: bigint): Promise<string[]> {
	const pcs: string[] = [];
	const visited = new Set<string>();
	let frontier = [pmId];
	for (let depth = 0; depth < 8 && frontier.length > 0; depth++) {
		const next: bigint[] = [];
		for (const id of frontier) {
			const key = String(id);
			if (visited.has(key)) continue;
			visited.add(key);
			try {
				const parents = await QueryService.getAdjacentDescendants(id);
				for (const p of parents) {
					if (p.type === 'PC') pcs.push(p.name);
					else next.push(p.id);
				}
			} catch { /* skip */ }
		}
		if (pcs.length > 0) break;
		frontier = next;
	}
	return [...new Set(pcs)].sort();
}

export interface PMNodeProps extends NodeRendererProps<TreeNode> {
	clickHandlers?: PMTreeClickHandlers;
	direction: TreeDirection;
	treeDataAtom: PrimitiveAtom<TreeNode[]>;
	filterConfigAtom: PrimitiveAtom<TreeFilterConfig>;
	className?: string;
}

export function PMNode({ node, style, tree, clickHandlers, direction, treeDataAtom, filterConfigAtom, className }: PMNodeProps) {
	const { themeMode } = useTheme();
	const theme = useMantineTheme();
	const [filterConfig] = useAtom(filterConfigAtom);
	const { toggleNodeWithData } = usePMTreeOperations(treeDataAtom, direction, filterConfig);

	const [pcBadges, setPcBadges] = useState<string[]>(() => {
		if (!node.data.pmId || node.data.type === 'PC' || node.data.isAssociation) return [];
		return pcCache.get(String(node.data.pmId)) ?? [];
	});

	useEffect(() => {
		const { pmId, type, isAssociation } = node.data;
		if (!pmId || type === 'PC' || isAssociation) return;
		const key = String(pmId);
		if (pcCache.has(key)) {
			setPcBadges(pcCache.get(key)!);
			return;
		}
		fetchPCsForNode(pmId).then(pcs => {
			pcCache.set(key, pcs);
			setPcBadges(pcs);
		});
	}, [node.data.pmId, node.data.type, node.data.isAssociation]);

	const handleExpansionClick = async (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();

		await toggleNodeWithData(node);
	};

	const handleDoubleClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();

		// Call the double click callback if provided
		if (clickHandlers?.onDoubleClick) {
			clickHandlers.onDoubleClick(node.data);
		}
	};

	const handleContextMenu = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();

		// Call the right click callback if provided
		if (clickHandlers?.onRightClick) {
			clickHandlers.onRightClick(node.data, e);
		}
	};

	const handleLeftClick = (e: React.MouseEvent) => {
		// Call the left click callback if provided
		if (clickHandlers?.onLeftClick) {
			clickHandlers.onLeftClick(node.data);
		}
	};

	const renderGuideLines = () => {
		const lines = [];
		let depth = node.level;

		if (depth > 0) {
			// Add vertical lines for each level except the current node
			for (let i = 0; i < depth; i++) {
				// Position the line to align with parent nodes
				const left = i * INDENT_NUM + 10;

				lines.push(
					<div
						key={`guideline-${node.data.id}-${i}`}
						className={classes.guideLine}
						style={{
							left: `${left}px`,
							top: 0,
							height: '100%'
						}}
					/>
				);
			}

			// Add the horizontal connector line from the vertical line to the current node
			lines.push(
				<div
					key={`horizontal-${node.data.id}`}
					className={classes.horizontalLine}
					style={{
						left: `${(depth - 1) * INDENT_NUM + 12}px`,
						width: `${14}px`,
						top: 'calc(50% - 0.5px)'
					}}
				/>
			);
		}

		return lines;
	};

	const renderNodeContent = () => {
		const truncatedName = truncateMiddle(node.data.name, 40);
		const shouldShowTooltip = node.data.name.length > 40;
		const isAssociation = node.data.isAssociation;
		const associationType = node.data.associationDetails?.type;

		return (
			<div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0, whiteSpace: 'nowrap', }}>
				{isAssociation && associationType === 'outgoing' && (
					<OutgoingAssociationIcon
						color={theme.colors.green[9]}
						size="20px"
					/>
				)}
				{isAssociation && associationType === 'incoming' && (
					<IncomingAssociationIcon
						color={theme.colors.green[9]}
						size="20px"
					/>
				)}
				<NodeIcon
					type={node.data.type}
					size={20}
				/>
				<Tooltip label={node.data.name} position="top" disabled={!shouldShowTooltip}>
					<span style={{
						fontSize: '14px',
						fontWeight: 500,
						color: 'var(--mantine-color-text)',
						userSelect: 'none',
						whiteSpace: 'nowrap'
					}}>
						{truncatedName}
					</span>
				</Tooltip>
				{pcBadges.map(pc => (
					<span key={pc} style={{
						display: 'inline-flex',
						alignItems: 'center',
						fontSize: '10px',
						lineHeight: '16px',
						padding: '0 4px',
						borderRadius: 3,
						backgroundColor: 'var(--mantine-color-green-0)',
						color: 'var(--mantine-color-green-9)',
						border: '1px solid var(--mantine-color-green-9)',
						fontWeight: 600,
						whiteSpace: 'nowrap',
						flexShrink: 0,
					}}>
						{pc}
					</span>
				))}
			</div>
		);
	};

	return (
		<>
			<div
				style={style}
				className={clsx(
					classes.node,
					node.state,
					className
				)}
				onContextMenu={handleContextMenu}
				onDoubleClick={handleDoubleClick}
				onClick={handleLeftClick}
			>
				{renderGuideLines()}

				<ActionIcon
					size={20}
					variant="transparent"
					style={{ marginRight: '6px', marginLeft: '.5px' }}
					onClick={shouldShowExpansionIcon(direction, node.data) ? handleExpansionClick : undefined}
				>
					{node.data.isLoading ? (
						<Loader size={16} />
					) : shouldShowExpansionIcon(direction, node.data) ? (
						node.isOpen ? (
							<IconSquareRoundedMinus
								stroke={2}
								size={16}
								color={themeMode === 'dark' ? 'var(--mantine-color-gray-4)' : 'var(--mantine-color-gray-9)'}
							/>
						) : (
							<IconSquareRoundedPlus
								stroke={2}
								size={16}
								color={themeMode === 'dark' ? 'var(--mantine-color-gray-4)' : 'var(--mantine-color-gray-9)'}
							/>
						)
					) : <IconPoint
						stroke={2}
						size={16}
						color={themeMode === 'dark' ? 'var(--mantine-color-gray-4)' : 'var(--mantine-color-gray-9)'}
					/>}
				</ActionIcon>

				{renderNodeContent()}
			</div>

		</>
	);
}