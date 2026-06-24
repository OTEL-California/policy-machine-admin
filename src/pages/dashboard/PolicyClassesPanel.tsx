import React, { useCallback, useEffect, useState } from 'react';
import { IconPlus, IconRefresh } from '@tabler/icons-react';
import { useAtomValue, useSetAtom } from 'jotai';
import { ActionIcon, Accordion, Button, Group, Loader, Menu, Modal, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { PMTree, TreeFilterConfig, useNodeContextMenu } from '@/features/pmtree';
import {
  AssociationDirection,
  NodeIcon,
  sortTreeNodes,
  transformNodeToTreeNode,
  TreeNode,
} from '@/features/pmtree/tree-utils';
import { ProhibitionDetails } from '@/features/prohibitions';
import * as AdjudicationService from '@/shared/api/pdp_adjudication.api';
import * as QueryService from '@/shared/api/pdp_query.api';
import { NodeType, PMNode } from '@/shared/api/pdp.types';
import { PANEL_RADIUS } from '@/theme';
import { selectedNodeAtom, selectedUANodeAtom, startAssociationAtom } from './dashboard-atoms';

const DIVIDER = 'var(--mantine-color-gray-2)';
// Floor for the expanded detail panel so it stays readable when many policy
// classes are listed; the accordion scrolls instead of crushing the tree.
const PANEL_MIN_HEIGHT = 420;

const TREE_FILTERS: TreeFilterConfig = {
  nodeTypes: [NodeType.PC, NodeType.UA, NodeType.OA, NodeType.U, NodeType.O],
  showOutgoingAssociations: false,
  showIncomingAssociations: true,
};

// ─── Accordion panel content: tree for a single PC, loaded on first expand ───────

const CREATABLE_CHILD_TYPES = [NodeType.UA, NodeType.OA, NodeType.O] as const;

function PcTreePanel({
  rootNodes,
  onRefresh,
  pcId,
}: {
  rootNodes?: TreeNode[];
  onRefresh: () => void;
  pcId: bigint;
}) {
  const [prohibitionNode, setProhibitionNode] = useState<TreeNode | null>(null);
  const [createType, setCreateType] = useState<NodeType | null>(null);
  const [newChildName, setNewChildName] = useState('');
  const [creatingChild, setCreatingChild] = useState(false);
  const setSelectedNode = useSetAtom(selectedNodeAtom);
  const setStartAssociation = useSetAtom(startAssociationAtom);
  const selectedUANode = useAtomValue(selectedUANodeAtom);

  // Re-fetch this PC's tree after a create/delete; the parent replaces this PC's
  // entry in the prefetched roots map, producing a fresh `rootNodes` array that
  // PMTree re-renders.
  const refresh = onRefresh;

  const closeCreateChild = () => {
    setCreateType(null);
    setNewChildName('');
  };

  const handleCreateChild = async () => {
    const name = newChildName.trim();
    if (!createType || !name) {
      return;
    }

    setCreatingChild(true);
    try {
      switch (createType) {
        case NodeType.UA:
          await AdjudicationService.createUserAttribute(name, [pcId]);
          break;
        case NodeType.OA:
          await AdjudicationService.createObjectAttribute(name, [pcId]);
          break;
        case NodeType.O:
          await AdjudicationService.createObject(name, [pcId]);
          break;
        default:
          return;
      }
      notifications.show({
        title: 'Node Created',
        message: `Successfully created ${createType} "${name}"`,
        color: 'green',
      });
      closeCreateChild();
      refresh();
    } catch (error) {
      notifications.show({
        title: 'Create Error',
        message: `Failed to create node: ${(error as Error).message}`,
        color: 'red',
      });
    } finally {
      setCreatingChild(false);
    }
  };

  const createChildButtons = (
    <Menu position="bottom-start" withinPortal>
      <Menu.Target>
        <Tooltip label="Create node" position="top" openDelay={300}>
          <ActionIcon variant="subtle" color="gray" radius="xl" size="lg">
            <IconPlus size={20} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        {CREATABLE_CHILD_TYPES.map((nt) => (
          <Menu.Item key={nt} leftSection={<NodeIcon type={nt} size={16} />} onClick={() => setCreateType(nt)}>
            Create {nt}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );

  // Show a node in the right Node Info panel, clearing any pending association
  // so a plain selection doesn't reopen inline association mode.
  const showInfo = useCallback(
    (node: TreeNode) => {
      setStartAssociation(null);
      setSelectedNode(node);
    },
    [setSelectedNode, setStartAssociation]
  );

  const { onRightClick, menu } = useNodeContextMenu({
    onInfo: showInfo,
    onAssociationNodeRightClick: showInfo,
    onCreateProhibition: setProhibitionNode,
    onMutated: refresh,
    selectedAssociableNode: selectedUANode,
    onAssociate: (node) => {
      setSelectedNode(node);
      setStartAssociation({
        direction: AssociationDirection.Incoming,
        otherNode: selectedUANode!,
        nonce: Date.now(),
      });
    },
  });

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        overflow: 'hidden',
        borderTop: `1px solid ${DIVIDER}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', position: 'relative' }}>
        {/* PMTree is always mounted (never swapped out) so its expansion,
            selection and scroll state survive collapse/reopen of the panel. */}
        <PMTree
          style={{ width: '100%', height: '100%' }}
          direction="ascendants"
          rootNodes={rootNodes ?? []}
          filterConfig={TREE_FILTERS}
          showTreeFilters
          showDirection
          showCreatePolicyClass={false}
          showReset
          leftToolbarSection={createChildButtons}
          clickHandlers={{ onLeftClick: showInfo, onRightClick }}
        />
        {rootNodes === undefined && (
          <Group
            justify="center"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'var(--mantine-color-body)',
            }}
          >
            <Loader size="sm" />
          </Group>
        )}
      </div>

      {menu}

      <Modal
        opened={!!prohibitionNode}
        onClose={() => setProhibitionNode(null)}
        title={
          <Text size="lg" fw={600}>
            Create Prohibition
          </Text>
        }
        size="lg"
      >
        {prohibitionNode && (
          <ProhibitionDetails
            selectedNodes={[prohibitionNode]}
            onCancel={() => setProhibitionNode(null)}
            onSuccess={() => setProhibitionNode(null)}
          />
        )}
      </Modal>

      <Modal
        opened={!!createType}
        onClose={closeCreateChild}
        title={
          <Text size="lg" fw={600}>
            Create {createType}
          </Text>
        }
        size="sm"
      >
        <Stack gap="md">
          <TextInput
            label="Name"
            placeholder="Name"
            value={newChildName}
            onChange={(e) => setNewChildName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (newChildName.trim()) {
                  handleCreateChild();
                }
              }
            }}
            data-autofocus
            required
            leftSection={createType && <NodeIcon type={createType} size={20} />}
          />

          <Group justify="flex-end" gap="sm" mt="md">
            <Button variant="outline" onClick={closeCreateChild}>
              Cancel
            </Button>
            <Button onClick={handleCreateChild} disabled={!newChildName.trim()} loading={creatingChild}>
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}

// ─── PC accordion list (master + inline detail) ──────────────────────────────────

// Fetch a single PC's ascendant root nodes, transformed into TreeNodes.
async function fetchPcRoots(pcId: bigint): Promise<TreeNode[]> {
  const privileges = await QueryService.selfComputeAdjacentAscendantPrivileges(pcId);
  return sortTreeNodes(
    privileges
      .filter((p) => p.node !== undefined)
      .map((p) => ({ ...transformNodeToTreeNode(p.node!), privileges: p.accessRights }))
  );
}

function PcAccordion({ leftPanelVisible }: { leftPanelVisible: boolean }) {
  const [pcs, setPcs] = useState<PMNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [createOpened, setCreateOpened] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  // Prefetched ascendant root nodes per PC (keyed by String(pc.id)). A missing
  // key means "still loading"; the panel shows a loader overlay until it lands.
  const [rootsByPc, setRootsByPc] = useState<Map<string, TreeNode[]>>(new Map());

  const fetchPcs = useCallback(() => {
    setLoading(true);
    return QueryService.getPolicyClasses()
      .then((list) => {
        setPcs(list);
        // Preload every PC's root nodes up front so opening a panel is instant.
        // allSettled so one failing PC doesn't block the rest.
        Promise.allSettled(
          list.map((pc) =>
            fetchPcRoots(pc.id).then((nodes) => {
              setRootsByPc((prev) => {
                const next = new Map(prev);
                next.set(String(pc.id), nodes);
                return next;
              });
            })
          )
        );
      })
      .finally(() => setLoading(false));
  }, []);

  // Re-fetch a single PC's roots after a mutation, replacing only that key so
  // the other trees keep their stable array references (and their state).
  const refreshPc = useCallback((pcId: string) => {
    fetchPcRoots(BigInt(pcId)).then((nodes) => {
      setRootsByPc((prev) => {
        const next = new Map(prev);
        next.set(pcId, nodes);
        return next;
      });
    });
  }, []);

  useEffect(() => {
    fetchPcs();
  }, [fetchPcs]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      return;
    }

    setCreating(true);
    try {
      await AdjudicationService.createPolicyClass(name);
      notifications.show({
        title: 'Policy Class Created',
        message: `Successfully created "${name}"`,
        color: 'green',
      });
      setCreateOpened(false);
      setNewName('');
      await fetchPcs();
    } catch (error) {
      notifications.show({
        title: 'Create Error',
        message: `Failed to create policy class: ${(error as Error).message}`,
        color: 'red',
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Header — padding/border matches the User Attributes panel title so the two stay aligned */}
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
          <Group gap={8}>
            <Text
              size="xs"
              fw={700}
              style={{
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: 'var(--mantine-color-gray-6)',
                lineHeight: '20px',
              }}
            >
              Policy Classes
            </Text>
            {!loading && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 20,
                  height: 20,
                  paddingInline: 6,
                  borderRadius: PANEL_RADIUS,
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
          </Group>
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              paddingInline: leftPanelVisible ? 16 : 48,
              paddingBlock: 24,
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Group justify="flex-start" mb={16} gap="xs">
              <Tooltip label="Refresh" position="top" openDelay={300}>
                <ActionIcon variant="subtle" color="gray" size="lg" onClick={fetchPcs} loading={loading}>
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlus size={14} />}
                onClick={() => setCreateOpened(true)}
              >
                New Policy Class
              </Button>
            </Group>

            {loading ? (
              <Group justify="center" mt="xl">
                <Loader size="sm" />
              </Group>
            ) : pcs.length === 0 ? (
              <Text size="xs" c="dimmed" ta="center" mt={40}>
                No policy classes
              </Text>
            ) : (
              <Accordion
                value={expanded}
                onChange={setExpanded}
                variant="separated"
                chevronPosition="right"
                // Keep this non-zero: a value of 0 makes Mantine's Collapse
                // unmount collapsed panel content, which would destroy each
                // tree's state on collapse. 200ms (Mantine's own default)
                // reads smoother than a snappier value once a panel's tree
                // is already mounted from a prior open.
                transitionDuration={200}
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflowY: 'auto',
                }}
                styles={{
                  control: { flexShrink: 0 },
                  panel: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
                  content: {
                    padding: 0,
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                  },
                }}
              >
                {pcs.map((pc) => {
                  const value = String(pc.id);
                  return (
                    <Accordion.Item
                      key={value}
                      value={value}
                      style={
                        expanded === value
                          ? {
                              display: 'flex',
                              flexDirection: 'column',
                              flex: 1,
                              minHeight: PANEL_MIN_HEIGHT,
                            }
                          : undefined
                      }
                    >
                      <Accordion.Control icon={<NodeIcon type={NodeType.PC} size={20} />}>
                        <Text fw={500} size="sm">
                          {pc.name}
                        </Text>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <PcTreePanel
                          rootNodes={rootsByPc.get(value)}
                          onRefresh={() => refreshPc(value)}
                          pcId={pc.id}
                        />
                      </Accordion.Panel>
                    </Accordion.Item>
                  );
                })}
              </Accordion>
            )}
          </div>
        </div>
      </div>

      <Modal
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
        title={
          <Text size="lg" fw={600}>
            New Policy Class
          </Text>
        }
        size="sm"
      >
        <Stack gap="md">
          <TextInput
            label="Name"
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (newName.trim()) {
                  handleCreate();
                }
              }
            }}
            data-autofocus
            required
            leftSection={<NodeIcon type={NodeType.PC} size={20} />}
          />

          <Group justify="flex-end" gap="sm" mt="md">
            <Button variant="outline" onClick={() => setCreateOpened(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim()} loading={creating}>
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function PolicyClassesPanel({ leftPanelVisible = false }: { leftPanelVisible?: boolean }) {
  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <PcAccordion leftPanelVisible={leftPanelVisible} />
    </div>
  );
}
