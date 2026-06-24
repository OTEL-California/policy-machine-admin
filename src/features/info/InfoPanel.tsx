import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
	IconEdit,
	IconPlus,
	IconSquareRoundedMinus,
	IconSwitchHorizontal,
	IconX
} from "@tabler/icons-react";
import { NodeApi } from "react-arborist";
import {ActionIcon, Alert, Box, Button, Divider, Group, Popover, Stack, Text, Tooltip, useMantineTheme} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { PMTree } from "@/features/pmtree";
import { fetchAssociationChildren } from "@/features/pmtree/tree-data-fetcher";
import { AssociationDirection, NodeIcon, sortTreeNodes, transformNodesToTreeNodes, TreeNode } from "@/features/pmtree/tree-utils";
import { Node, NODE_TYPES, NodePrivilegeInfo, NodeType } from "@/shared/api/pdp.types";
import * as QueryService from "@/shared/api/pdp_query.api";
import * as AdjudicationService from "@/shared/api/pdp_adjudication.api";
import { PANEL_RADIUS } from "@/theme";
import { AccessRightsTree } from "@/components/access-rights";

// Helper function to transform NodePrivilegeInfo to TreeNode
function transformNodePrivilegeInfoToTreeNodes(privileges: NodePrivilegeInfo[]): TreeNode[] {
	const nodes = privileges
		.map(priv => priv.node)
		.filter((node): node is NonNullable<typeof node> => node !== undefined);

	return transformNodesToTreeNodes(nodes);
}

type InlineAssocState = {
	mode: 'create' | 'edit';
	direction: AssociationDirection;
	otherNode: TreeNode | null;
	selectedRights: string[];
	pickingNode: TreeNode | null;
	isPicking: boolean;
	editingNode: TreeNode | null;
} | null;


export interface InfoPanelProps {
	rootNode: TreeNode;
	onClose?: () => void;
	startAssociation?: { direction: AssociationDirection; otherNode: TreeNode; nonce: number };
	/**
	 * "split" (default) lays Descendants and Associations side-by-side.
	 * "stacked" places them one above the other — better for a narrow column.
	 */
	layout?: 'split' | 'stacked';
}

export function InfoPanel(props: InfoPanelProps) {
	const theme = useMantineTheme();
	const stacked = props.layout === 'stacked';

	const [associationRootNodes, setAssociationRootNodes] = useState<TreeNode[]>([]);
	const [descendantsNodes, setDescendantsNodes] = useState<TreeNode[]>([]);
	const [resourceOperations, setResourceOperations] = useState<string[]>([]);

	// Assignment mode state
	const [assignmentTargets, setAssignmentTargets] = useState<TreeNode[]>([]);
	const [isAssignmentPickerOpen, setIsAssignmentPickerOpen] = useState(false);
	const [pickingAssignmentNode, setPickingAssignmentNode] = useState<TreeNode | null>(null);

	// Inline association creation/edit state
	const [inlineAssoc, setInlineAssoc] = useState<InlineAssocState>(null);

	// Descendants tree selection state
	const [selectedDescendantNode, setSelectedDescendantNode] = useState<TreeNode | null>(null);

	// Association tree state
	const [selectedAssociationDirection, setSelectedAssociationDirection] = useState<AssociationDirection>(AssociationDirection.Incoming);

	// Reset assignment mode when a different node is opened
	useEffect(() => {
		setAssignmentTargets([]);
		setIsAssignmentPickerOpen(false);
		setPickingAssignmentNode(null);
		setInlineAssoc(null);
	}, [props.rootNode.pmId]);

	// Enter inline association creation mode when triggered from outside (e.g. context menu)
	useEffect(() => {
		if (!props.startAssociation) return;
		const { direction, otherNode } = props.startAssociation;
		setInlineAssoc({ mode: 'create', direction, otherNode, selectedRights: [], pickingNode: null, isPicking: false, editingNode: null });
		setSelectedAssociationDirection(direction);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [props.startAssociation?.nonce]);

	// Handle selection in descendants tree
	const handleDescendantSelection = useCallback((nodeApi: any[]) => {
		if (nodeApi && nodeApi.length > 0) {
			const selectedNode = nodeApi[0].data as TreeNode;
			setSelectedDescendantNode(selectedNode);
		} else {
			setSelectedDescendantNode(null);
		}
	}, []);


	// Check if the selected node is a root node in the descendants tree
	const isSelectedNodeRoot = useMemo(() => {
		if (!selectedDescendantNode) { return false; }
		return descendantsNodes.some(rootNode => rootNode.id === selectedDescendantNode.id);
	}, [selectedDescendantNode, descendantsNodes]);


	// Deassign selected descendant node
	const handleDeassignSelected = useCallback(async () => {
		if (!selectedDescendantNode || !props.rootNode.pmId || !selectedDescendantNode.pmId) {
			return;
		}

		try {
			await AdjudicationService.deassign(props.rootNode.pmId, [selectedDescendantNode.pmId]);

			// Immediately remove the deassigned node from the descendants tree
			setDescendantsNodes(currentNodes =>
				currentNodes.filter(node => node.pmId !== selectedDescendantNode.pmId)
			);

			notifications.show({
				title: 'Deassigned',
				message: `Successfully deassigned "${selectedDescendantNode.name}" from "${props.rootNode.name}"`,
				color: 'green',
			});

			// Clear selection since the node is no longer assigned
			setSelectedDescendantNode(null);
		} catch (error) {
			notifications.show({
				title: 'Deassign Error',
				message: (error as Error).message,
				color: 'red',
			});
		}
	}, [selectedDescendantNode, props.rootNode]);

	// Assignment mode handlers
	const handleStartAssignment = useCallback(() => {
		setAssignmentTargets([]);
		setIsAssignmentPickerOpen(true);
	}, []);

	const handleCancelAssignment = useCallback(() => {
		setAssignmentTargets([]);
		setIsAssignmentPickerOpen(false);
		setPickingAssignmentNode(null);
	}, []);

	const handleAssignmentPickerSelect = useCallback((nodes: NodeApi<TreeNode>[]) => {
		const node = nodes?.[0]?.data ?? null;
		setPickingAssignmentNode(node);
	}, []);

	const handleConfirmAssignmentPicker = useCallback(() => {
		if (!pickingAssignmentNode) return;
		setAssignmentTargets(prev =>
			prev.some(n => n.id === pickingAssignmentNode.id) ? prev : [...prev, pickingAssignmentNode]
		);
		setPickingAssignmentNode(null);
		// Keep picker open so user can add more
	}, [pickingAssignmentNode]);

	const handleSubmitAssignment = useCallback(async () => {
		const descendantIds = assignmentTargets.map(node => node.pmId).filter(id => id !== undefined);

		if (!props.rootNode.pmId || descendantIds.length === 0) {
			return;
		}

		try {
			// Use the assign API to create assignments
			await AdjudicationService.assign(props.rootNode.pmId, descendantIds);

			setAssignmentTargets([]);
			setIsAssignmentPickerOpen(false);
			setPickingAssignmentNode(null);

			// Refresh descendants tree
			const updatedDescendants = await QueryService.selfComputeAdjacentDescendantPrivileges(props.rootNode.pmId);
			const transformedDescendants = transformNodePrivilegeInfoToTreeNodes(updatedDescendants);
			setDescendantsNodes(transformedDescendants);

			// Refresh the associations tree as assignments can affect associations
			const updatedAssociations = await fetchAssociationChildren(
				props.rootNode.pmId,
				{
					nodeTypes: NODE_TYPES,
					showIncomingAssociations: true,
					showOutgoingAssociations: true,
				},
				props.rootNode.id
			);
			setAssociationRootNodes(updatedAssociations);

			notifications.show({
				color: 'green',
				title: 'Assigned',
				message: `Successfully assigned ${assignmentTargets.map(node => node.name).join(', ')} to "${props.rootNode.name}"`,
			});

		} catch (error) {
			notifications.show({
				color: 'red',
				title: 'Assignment Error',
				message: (error as Error).message,
			});
		}
	}, [props.rootNode, assignmentTargets]);

	const handleRemoveAssignmentTarget = useCallback((nodeToRemove: TreeNode) => {
		setAssignmentTargets(prev => prev.filter(node => node.id !== nodeToRemove.id));
	}, []);

	// Inline association handlers
	const handleStartAssociation = useCallback((direction: AssociationDirection) => {
		setInlineAssoc({ mode: 'create', direction, otherNode: null, selectedRights: [], pickingNode: null, isPicking: false, editingNode: null });
		setSelectedAssociationDirection(direction);
	}, []);

	const handleSwitchAssociationDirection = useCallback(() => {
		setInlineAssoc(prev => {
			if (!prev) return null;
			const direction = prev.direction === AssociationDirection.Outgoing
				? AssociationDirection.Incoming
				: AssociationDirection.Outgoing;
			return { ...prev, direction, otherNode: null, pickingNode: null, isPicking: false };
		});
		setSelectedAssociationDirection(prev =>
			prev === AssociationDirection.Outgoing ? AssociationDirection.Incoming : AssociationDirection.Outgoing
		);
	}, []);

	const handleOpenPicker = useCallback(() => {
		setInlineAssoc(prev => prev ? { ...prev, isPicking: true, pickingNode: null } : null);
	}, []);

	const handleClosePicker = useCallback(() => {
		setInlineAssoc(prev => prev ? { ...prev, isPicking: false, pickingNode: null } : null);
	}, []);

	const handlePickerNodeSelect = useCallback((nodes: NodeApi<TreeNode>[]) => {
		const node = nodes?.[0]?.data ?? null;
		setInlineAssoc(prev => prev ? { ...prev, pickingNode: node } : null);
	}, []);

	const handleConfirmPicker = useCallback(() => {
		if (!inlineAssoc?.pickingNode) return;
		const { direction, pickingNode } = inlineAssoc;
		const type = pickingNode.type as NodeType;

		if (direction === AssociationDirection.Incoming) {
			if (type !== NodeType.UA) {
				notifications.show({ color: 'red', title: 'Invalid Source Node', message: 'Source node must be a User Attribute (UA).' });
				return;
			}
		} else {
			if (type !== NodeType.UA && type !== NodeType.OA && type !== NodeType.O) {
				notifications.show({ color: 'red', title: 'Invalid Target Node', message: 'Target node must be a User Attribute (UA), Object Attribute (OA), or Object (O).' });
				return;
			}
		}

		setInlineAssoc(prev =>
			prev ? { ...prev, otherNode: prev.pickingNode, isPicking: false, pickingNode: null } : null
		);
	}, [inlineAssoc]);

	const handleCancelInlineAssoc = useCallback(() => setInlineAssoc(null), []);

	const handleSubmitInlineAssoc = useCallback(async () => {
		if (!inlineAssoc?.otherNode?.pmId || !props.rootNode.pmId) return;
		const otherNodePmId = inlineAssoc.otherNode.pmId;
		const rootPmId = props.rootNode.pmId;
		const { mode, direction, otherNode, selectedRights } = inlineAssoc;
		const isOutgoing = direction === AssociationDirection.Outgoing;
		const sourcePmId = isOutgoing ? rootPmId : otherNodePmId;
		const targetPmId = isOutgoing ? otherNodePmId : rootPmId;

		if (mode === 'edit') {
			try {
				// Update existing association: dissociate then reassociate with new rights
				await AdjudicationService.dissociate(sourcePmId, targetPmId);
				await AdjudicationService.associate(sourcePmId, targetPmId, selectedRights);

				setAssociationRootNodes(prev => prev.map(node => {
					if (node.id === inlineAssoc.editingNode?.id) {
						return {
							...node,
							associationDetails: {
								...node.associationDetails!,
								accessRightSet: selectedRights,
							},
						};
					}
					return node;
				}));

				notifications.show({
					color: 'green',
					title: 'Association Updated',
					message: 'Association access rights have been updated successfully',
				});
				setInlineAssoc(null);
			} catch (error) {
				notifications.show({ color: 'red', title: 'Update Error', message: (error as Error).message });
			}
			return;
		}

		try {
			await AdjudicationService.associate(sourcePmId, targetPmId, selectedRights);
			notifications.show({ color: 'green', title: 'Association Created', message: `Created association with ${otherNode.name}` });
			const otherPmNode: Node = {
				id: otherNodePmId,
				name: otherNode.name,
				type: otherNode.type as NodeType,
				properties: {},
			};
			const rootPmNode: Node = {
				id: rootPmId,
				name: props.rootNode.name,
				type: props.rootNode.type as NodeType,
				properties: {},
			};
			const newAssocNode: TreeNode = {
				id: crypto.randomUUID(),
				pmId: otherNodePmId,
				name: otherNode.name,
				type: otherNode.type,
				children: [],
				parent: props.rootNode.id,
				isAssociation: true,
				associationDetails: {
					type: direction,
					accessRightSet: selectedRights,
					ua: isOutgoing ? rootPmNode : otherPmNode,
					target: isOutgoing ? otherPmNode : rootPmNode,
				},
			};
			setAssociationRootNodes(prev => sortTreeNodes([...prev, newAssocNode]));
			setInlineAssoc(null);
		} catch (error) {
			notifications.show({ color: 'red', title: 'Association Error', message: (error as Error).message });
		}
	}, [inlineAssoc, props.rootNode]);

	const handleDeleteAssociation = useCallback(async (associationNode: TreeNode) => {
		if (!props.rootNode?.pmId || !associationNode.pmId) {
			return;
		}

		try {
			const isOutgoing = associationNode.associationDetails?.type === AssociationDirection.Outgoing;
			const sourcePmId = isOutgoing ? props.rootNode.pmId : associationNode.pmId;
			const targetPmId = isOutgoing ? associationNode.pmId : props.rootNode.pmId;

			await AdjudicationService.dissociate(sourcePmId, targetPmId);

			// Remove the node from state
			setAssociationRootNodes(prev => prev.filter(node => node.id !== associationNode.id));

			notifications.show({
				color: 'green',
				title: 'Association Deleted',
				message: 'Association has been deleted successfully',
			});

		} catch (error) {
			notifications.show({
				color: 'red',
				title: 'Delete Error',
				message: (error as Error).message,
			});
		}
	}, [props.rootNode]);

	const handleDeleteInlineAssoc = useCallback(async () => {
		if (!inlineAssoc?.editingNode) return;
		await handleDeleteAssociation(inlineAssoc.editingNode);
		setInlineAssoc(null);
	}, [inlineAssoc, handleDeleteAssociation]);

	// Fetch association nodes for the root node
	useEffect(() => {
		if (props.rootNode.pmId) {
			fetchAssociationChildren(
				props.rootNode.pmId,
				{
					nodeTypes: [NodeType.UA, NodeType.OA, NodeType.U, NodeType.O],
					showIncomingAssociations: true,
					showOutgoingAssociations: true,
				},
				props.rootNode.id
			).then(setAssociationRootNodes);
		}
	}, [props.rootNode.pmId, props.rootNode.id]);

	// Fetch descendants nodes for the root node
	useEffect(() => {
		if (props.rootNode.pmId) {
			QueryService.selfComputeAdjacentDescendantPrivileges(props.rootNode.pmId)
				.then(transformNodePrivilegeInfoToTreeNodes)
				.then(setDescendantsNodes);
		}
	}, [props.rootNode.pmId]);

	// Fetch resource operations
	useEffect(() => {
		async function fetchResourceOperations() {
			try {
				const accessRights = await QueryService.getResourceAccessRights();
				setResourceOperations(accessRights);
			} catch (error) {
				setResourceOperations([]);
			}
		}
		fetchResourceOperations();
	}, []);

	// Ensure selected direction is valid for the node type
	useEffect(() => {
		const nodeType = props.rootNode.type;
		const canHaveIncoming = nodeType === NodeType.O || nodeType === NodeType.OA || nodeType === NodeType.UA;
		const canHaveOutgoing = nodeType === NodeType.UA;

		// If current selection is invalid, switch to a valid one
		if (selectedAssociationDirection === AssociationDirection.Incoming && !canHaveIncoming) {
			if (canHaveOutgoing) {
				setSelectedAssociationDirection(AssociationDirection.Outgoing);
			}
		} else if (selectedAssociationDirection === AssociationDirection.Outgoing && !canHaveOutgoing) {
			if (canHaveIncoming) {
				setSelectedAssociationDirection(AssociationDirection.Incoming);
			}
		}
	}, [props.rootNode.type, selectedAssociationDirection]);

	const handleAssociationSelected = useCallback((node: NodeApi<TreeNode>[]) => {
		if (node && node.length > 0) {
			const selectedNode = node[0].data as TreeNode;

			if (!selectedNode.isAssociation || !selectedNode.associationDetails) {
				return;
			}

			// Open the association inline, in the same form used to create associations
			const { type, accessRightSet } = selectedNode.associationDetails;
			setInlineAssoc({
				mode: 'edit',
				direction: type,
				otherNode: selectedNode,
				selectedRights: accessRightSet || [],
				pickingNode: null,
				isPicking: false,
				editingNode: selectedNode,
			});
			setSelectedAssociationDirection(type);
		}
	}, []);

	// Memoize tree props to prevent unnecessary re-renders
	const associationTreeProps = useMemo(() => ({
		direction: "ascendants" as const,
		rootNodes: associationRootNodes,
		showSelectedNodeLabel: false,
		showReset: true,
		showTreeFilters: true,
		showDirection: true,
		showCreatePolicyClass: false,
		filterConfig: {
			nodeTypes: [NodeType.UA, NodeType.OA, NodeType.U, NodeType.O],
			showIncomingAssociations: true,
			showOutgoingAssociations: true,
		},
		clickHandlers: {
			onSelect: handleAssociationSelected
		}
	}), [associationRootNodes, handleAssociationSelected]);

	const showAssociationEmptyState = associationRootNodes.length === 0;

	return (
		<Stack gap="xs" style={{ padding: "10px 20px 20px 20px", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: stacked ? "var(--mantine-color-white)" : "var(--mantine-color-gray-0)" }}>
			{/* Compact Header - Icon spans both rows */}
			<Group gap="sm" wrap="nowrap" justify="space-between">
				<Group gap="sm" align="center" wrap="nowrap">
					<NodeIcon type={props.rootNode.type} size={40} />
					<Stack gap={0}>
						<Text fw={600} size="md" lh={1.2}>{props.rootNode.name}</Text>
						<Text size="xs" c="dimmed">ID: {String(props.rootNode.pmId)}</Text>
					</Stack>
				</Group>
			</Group>
			<Divider orientation="horizontal" />

			{/* Content sections - vertical layout for descendants and associations */}
			<Box style={{ flex: 1, display: 'flex', flexDirection: stacked ? 'column' : 'row', gap: stacked ? 12 : 0, minHeight: 0, overflow: 'hidden', alignItems: 'stretch' }}>
				{/* Descendants Tree / Assignment Panel */}
				{props.rootNode.type !== "PC" && (
					<Box style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', minWidth: 0, paddingRight: stacked ? 0 : 8 }}>
						<>
							<Group gap="xs" align="center" mb={8}>
								<Text size="md" fw={600}>Descendants</Text>
								<Popover
									opened={isAssignmentPickerOpen}
									onClose={handleCancelAssignment}
									position="bottom"
									width={520}
									withArrow
									shadow="md"
								>
									<Popover.Target>
										<Box style={{ display: 'inline-block' }}>
											<Button size="xs" variant="light" onClick={handleStartAssignment}>
												Assign To
											</Button>
										</Box>
									</Popover.Target>
									<Popover.Dropdown style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '2px solid var(--mantine-primary-color-filled)', borderRadius: '6px' }}>
										<Group px="sm" py={8} style={{ flexShrink: 0, backgroundColor: 'var(--mantine-primary-color-0)', borderBottom: '1px solid var(--mantine-primary-color-3)' }}>
											<Text size="xs" fw={700} c="var(--mantine-primary-color-filled)">Select Node to Assign</Text>
										</Group>
										<Box style={{ height: 300, minHeight: 0 }}>
											<PMTree
												direction="ascendants"
												showReset
												showTreeFilters={false}
												showDirection={false}
												showCreatePolicyClass={false}
												filterConfig={{
													nodeTypes: NODE_TYPES,
													showIncomingAssociations: false,
													showOutgoingAssociations: false,
												}}
												clickHandlers={{ onSelect: handleAssignmentPickerSelect }}
											/>
										</Box>
										{assignmentTargets.length > 0 && (
											<Box style={{ flexShrink: 0, borderBottom: '1px solid var(--mantine-color-gray-2)', padding: '4px 8px', maxHeight: 120, overflow: 'auto' }}>
												<Stack gap={2}>
													{assignmentTargets.map((node) => (
														<Group key={node.id} justify="space-between" style={{
															padding: '2px 4px',
															border: '1px solid var(--mantine-color-gray-2)',
															borderRadius: '4px',
															backgroundColor: 'white',
														}}>
															<Group gap="xs">
																<NodeIcon type={node.type} size={14} />
																<Text size="xs">{node.name}</Text>
															</Group>
															<ActionIcon size="xs" variant="subtle" color="red" onClick={() => handleRemoveAssignmentTarget(node)}>
																<IconSquareRoundedMinus size={20} />
															</ActionIcon>
														</Group>
													))}
												</Stack>
											</Box>
										)}
										<Group justify="flex-end" gap="xs" p="xs" style={{ flexShrink: 0 }}>
											<Button size="xs" variant="subtle" color="gray" onClick={handleCancelAssignment}>Cancel</Button>
											<Button size="xs" disabled={!pickingAssignmentNode} onClick={handleConfirmAssignmentPicker}>Add</Button>
											<Button size="xs" disabled={assignmentTargets.length === 0} onClick={handleSubmitAssignment}>Assign</Button>
										</Group>
									</Popover.Dropdown>
								</Popover>
								<Button size="xs" color="red" onClick={handleDeassignSelected}
									style={{ visibility: isSelectedNodeRoot && selectedDescendantNode ? 'visible' : 'hidden' }}>
									Deassign From
								</Button>
							</Group>
							<Box style={{ flex: 1, backgroundColor: theme.other.intellijContentBg, border: '1px solid var(--mantine-color-gray-3)', borderRadius: PANEL_RADIUS, minHeight: 0, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
								<PMTree
									key={`descendants-${descendantsNodes.length}-${descendantsNodes.map(n => n.id).join('-')}`}
									direction="descendants"
									rootNodes={descendantsNodes}
									showReset
									showTreeFilters
									showDirection
									filterConfig={{
										nodeTypes: NODE_TYPES,
										showIncomingAssociations: false,
										showOutgoingAssociations: false,
									}}
									clickHandlers={{
										onSelect: handleDescendantSelection
									}}
								/>
							</Box>
						</>
					</Box>
				)}

				{/* Associations Section */}
				{(() => {
					const nodeType = props.rootNode.type;
					const canHaveIncoming = nodeType === NodeType.O || nodeType === NodeType.OA || nodeType === NodeType.UA;
					const canHaveOutgoing = nodeType === NodeType.UA;
					const showAssociations = canHaveIncoming || canHaveOutgoing;

					if (!showAssociations) {return null;}

					return (
						<>
						<Box style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', minWidth: 0, paddingLeft: stacked ? 0 : 8 }}>
							<Group gap="xs" align="center" mb={8}>
								<Text size="md" fw={600}>Associations</Text>
								{!inlineAssoc && (
									<Button
										size="xs"
										color={theme.colors.green[9]}
										onClick={() => handleStartAssociation(
											nodeType === NodeType.UA ? AssociationDirection.Outgoing : AssociationDirection.Incoming
										)}
									>
										Associate
									</Button>
								)}
							</Group>

							{inlineAssoc ? (
								/* Inline create form */
								<Box style={{
									flex: 1,
									minHeight: 0,
									display: 'flex',
									flexDirection: 'column',
									border: '1px solid var(--mantine-color-gray-3)',
									borderRadius: PANEL_RADIUS,
									overflow: 'hidden',
									backgroundColor: 'var(--mantine-color-gray-0)',
								}}>
									<Box style={{ padding: '8px 12px', flexShrink: 0 }}>
										{/* Source */}
										<Box mb={4}>
											<Text size="xs" c="dimmed" mb={4}>Source</Text>
											<Box style={{ minHeight: 30, display: 'flex', alignItems: 'center' }}>
											{inlineAssoc.direction === AssociationDirection.Outgoing ? (
												/* Root node is the source (fixed) */
												<Group gap="xs">
													<NodeIcon type={props.rootNode.type} size={24} />
													<Text size="sm" fw={500}>{props.rootNode.name}</Text>
												</Group>
											) : inlineAssoc.mode === 'edit' ? (
												/* Editing: source cannot be changed */
												<Group gap="xs">
													<NodeIcon type={inlineAssoc.otherNode!.type} size={24} />
													<Text size="sm" fw={500}>{inlineAssoc.otherNode!.name}</Text>
												</Group>
											) : (
												/* Other node is the source (to be picked) */
												<Popover
													opened={inlineAssoc.isPicking}
													onClose={handleClosePicker}
													position="bottom"
													width={520}
													withArrow
													shadow="md"
												>
													<Popover.Target>
														<Box style={{ display: 'inline-block' }}>
															{inlineAssoc.otherNode ? (
																<Group gap="xs">
																	<NodeIcon type={inlineAssoc.otherNode.type} size={24} />
																	<Text size="sm" fw={500}>{inlineAssoc.otherNode.name}</Text>
																	<ActionIcon size="sm" variant="subtle" onClick={handleOpenPicker} title="Change">
																		<IconEdit size={18} />
																	</ActionIcon>
																</Group>
															) : (
																<Button size="xs" variant="outline" onClick={handleOpenPicker}>
																	Set Source
																</Button>
															)}
														</Box>
													</Popover.Target>
													<Popover.Dropdown style={{ padding: 0, height: 440, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '2px solid var(--mantine-primary-color-filled)', borderRadius: '6px' }}>
														<Group px="sm" py={8} style={{ flexShrink: 0, backgroundColor: 'var(--mantine-primary-color-0)', borderBottom: '1px solid var(--mantine-primary-color-3)' }}>
															<Text size="xs" fw={700} c="var(--mantine-primary-color-filled)">Select Source Node</Text>
														</Group>
														<Box style={{ flex: 1, minHeight: 0 }}>
															<PMTree
																direction="ascendants"
																showReset
																showTreeFilters={false}
																showDirection={false}
																showCreatePolicyClass={false}
																filterConfig={{
																	nodeTypes: [NodeType.PC, NodeType.UA],
																	showIncomingAssociations: false,
																	showOutgoingAssociations: false,
																}}
																clickHandlers={{ onSelect: handlePickerNodeSelect }}
															/>
														</Box>
														<Group gap="xs" p="xs" style={{ flexShrink: 0, borderTop: '1px solid var(--mantine-color-gray-2)', borderBottom: '1px solid var(--mantine-color-gray-2)', minHeight: 32 }}>
															{inlineAssoc.pickingNode ? (
																<>
																	<NodeIcon type={inlineAssoc.pickingNode.type} size={18} />
																	<Text size="xs" fw={500} style={{ flex: 1 }}>{inlineAssoc.pickingNode.name}</Text>
																</>
															) : (
																<Text size="xs" c="dimmed">No node selected</Text>
															)}
														</Group>
														<Group justify="flex-end" gap="xs" p="xs" style={{ flexShrink: 0 }}>
															<Button size="xs" variant="subtle" color="gray" onClick={handleClosePicker}>Cancel</Button>
															<Button size="xs" disabled={!inlineAssoc.pickingNode} onClick={handleConfirmPicker}>Set</Button>
														</Group>
													</Popover.Dropdown>
												</Popover>
											)}
											</Box>
										</Box>

										{nodeType === NodeType.UA && inlineAssoc.mode === 'create' && (
											<Group justify="flex-start" mb={4}>
												<Tooltip label={inlineAssoc.direction === AssociationDirection.Outgoing ? "Switch to target" : "Switch to source"}>
													<ActionIcon size="sm" variant="subtle" onClick={handleSwitchAssociationDirection}>
														<IconSwitchHorizontal size={16} style={{ transform: 'rotate(90deg)' }} />
													</ActionIcon>
												</Tooltip>
											</Group>
										)}

										{/* Target */}
										<Box mb={8}>
											<Text size="xs" c="dimmed" mb={4}>Target</Text>
											<Box style={{ minHeight: 30, display: 'flex', alignItems: 'center' }}>
											{inlineAssoc.direction === AssociationDirection.Incoming ? (
												/* Root node is the target (fixed) */
												<Group gap="xs">
													<NodeIcon type={props.rootNode.type} size={24} />
													<Text size="sm" fw={500}>{props.rootNode.name}</Text>
												</Group>
											) : inlineAssoc.mode === 'edit' ? (
												/* Editing: target cannot be changed */
												<Group gap="xs">
													<NodeIcon type={inlineAssoc.otherNode!.type} size={24} />
													<Text size="sm" fw={500}>{inlineAssoc.otherNode!.name}</Text>
												</Group>
											) : (
												/* Other node is the target (to be picked) */
												<Popover
													opened={inlineAssoc.isPicking}
													onClose={handleClosePicker}
													position="bottom"
													width={520}
													withArrow
													shadow="md"
												>
													<Popover.Target>
														<Box style={{ display: 'inline-block' }}>
															{inlineAssoc.otherNode ? (
																<Group gap="xs">
																	<NodeIcon type={inlineAssoc.otherNode.type} size={24} />
																	<Text size="sm" fw={500}>{inlineAssoc.otherNode.name}</Text>
																	<ActionIcon size="sm" variant="subtle" onClick={handleOpenPicker} title="Change">
																		<IconEdit size={18} />
																	</ActionIcon>
																</Group>
															) : (
																<Button size="xs" variant="outline" onClick={handleOpenPicker}>
																	Set Target
																</Button>
															)}
														</Box>
													</Popover.Target>
													<Popover.Dropdown style={{ padding: 0, height: 440, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '2px solid var(--mantine-primary-color-filled)', borderRadius: '6px' }}>
														<Group px="sm" py={8} style={{ flexShrink: 0, backgroundColor: 'var(--mantine-primary-color-0)', borderBottom: '1px solid var(--mantine-primary-color-3)' }}>
															<Text size="xs" fw={700} c="var(--mantine-primary-color-filled)">Select Target Node</Text>
														</Group>
														<Box style={{ flex: 1, minHeight: 0 }}>
															<PMTree
																direction="ascendants"
																showReset
																showTreeFilters={false}
																showDirection={false}
																showCreatePolicyClass={false}
																filterConfig={{
																	nodeTypes: [NodeType.PC, NodeType.OA, NodeType.UA, NodeType.O],
																	showIncomingAssociations: false,
																	showOutgoingAssociations: false,
																}}
																clickHandlers={{ onSelect: handlePickerNodeSelect }}
															/>
														</Box>
														<Group gap="xs" p="xs" style={{ flexShrink: 0, borderTop: '1px solid var(--mantine-color-gray-2)', borderBottom: '1px solid var(--mantine-color-gray-2)', minHeight: 32 }}>
															{inlineAssoc.pickingNode ? (
																<>
																	<NodeIcon type={inlineAssoc.pickingNode.type} size={18} />
																	<Text size="xs" fw={500} style={{ flex: 1 }}>{inlineAssoc.pickingNode.name}</Text>
																</>
															) : (
																<Text size="xs" c="dimmed">No node selected</Text>
															)}
														</Group>
														<Group justify="flex-end" gap="xs" p="xs" style={{ flexShrink: 0 }}>
															<Button size="xs" variant="subtle" color="gray" onClick={handleClosePicker}>Cancel</Button>
															<Button size="xs" disabled={!inlineAssoc.pickingNode} onClick={handleConfirmPicker}>Set</Button>
														</Group>
													</Popover.Dropdown>
												</Popover>
											)}
											</Box>
										</Box>
									</Box>

									{/* Access Rights Tree */}
									<Box style={{
										flex: 1,
										minHeight: 0,
										display: 'flex',
										flexDirection: 'column',
										borderTop: '1px solid var(--mantine-color-gray-3)',
									}}>
										<AccessRightsTree
											availableRights={resourceOperations}
											selectedRights={inlineAssoc.selectedRights}
											onChange={(rights) => setInlineAssoc(prev => prev ? { ...prev, selectedRights: rights } : null)}
											disabled={!inlineAssoc.otherNode}
										/>
									</Box>

									{/* Form action buttons */}
									<Group justify="center" gap="xs" p={8} style={{ flexShrink: 0, borderTop: '1px solid var(--mantine-color-gray-2)' }}>
										<Button size="xs" variant="outline" color="gray" onClick={handleCancelInlineAssoc}>Cancel</Button>
										{inlineAssoc.mode === 'edit' && (
											<Button size="xs" variant="filled" color="red" onClick={handleDeleteInlineAssoc}>
												Delete
											</Button>
										)}
										<Button
											size="xs"
											disabled={!inlineAssoc.otherNode || inlineAssoc.selectedRights.length === 0}
											onClick={handleSubmitInlineAssoc}
										>
											Associate
										</Button>
									</Group>
								</Box>
							) : (
								/* Normal associations tree */
								<Box
									style={{
										flex: 1,
										minHeight: 0,
										border: '1px solid var(--mantine-color-gray-3)',
										borderRadius: PANEL_RADIUS,
										display: 'flex',
										minWidth: 0,
										height: '100%',
										overflow: 'hidden',
										backgroundColor: theme.other.intellijContentBg
									}}
								>
									<Box style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
										{showAssociationEmptyState ? (
											<Alert variant="light" color="gray" p="xs">
												<Text size="xs" c="dimmed">No associations</Text>
											</Alert>
										) : (
											<PMTree {...associationTreeProps} />
										)}
									</Box>
								</Box>
							)}
						</Box>
						</>
					);
            })()}
			</Box>
		</Stack>
	)
}
