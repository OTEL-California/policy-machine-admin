import React from 'react';
import { PMTree, TreeFilterConfig } from '@/features/pmtree';
import { NodeType } from '@/shared/api/pdp.types';

const UA_TREE_FILTERS: TreeFilterConfig = {
    nodeTypes: [NodeType.PC, NodeType.UA, NodeType.U],
    showOutgoingAssociations: false,
    showIncomingAssociations: false,
};

type Props = {
    activeId: string;
    onClose: () => void;
};

export function Dashboard2Panel({ activeId, onClose }: Props) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Panel content */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {activeId === 'ua-tree' ? (
                    <PMTree
                        style={{ width: '100%', height: '100%' }}
                        direction="ascendants"
                        filterConfig={UA_TREE_FILTERS}
                        showTreeFilters={false}
                        showDirection={false}
                        showCreatePolicyClass={false}
                    />
                ) : (
                    <div style={{ color: 'var(--mantine-color-dimmed)', fontSize: 14, paddingTop: 32, textAlign: 'center', padding: '32px 24px 24px' }}>
                        {activeId} panel
                        <br />
                        <span style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
                            Replace this with your panel content.
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
