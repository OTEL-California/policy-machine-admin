export const MOCK_PCS = ['HR Policy', 'Finance Policy', 'IT Policy'] as const;
export type MockPC = typeof MOCK_PCS[number];

export type MockNode = {
    id: string;
    name: string;
    type: 'UA' | 'OA' | 'U' | 'O';
    parentId?: string;
};

export const MOCK_NODES: Record<MockPC, MockNode[]> = {
    'HR Policy': [
        { id: 'u1', name: 'HR Managers',    type: 'UA' },
        { id: 'u2', name: 'HR Staff',        type: 'UA', parentId: 'u1' },
        { id: 'u3', name: 'Recruiters',      type: 'UA', parentId: 'u1' },
        { id: 'a1', name: 'Employee Records',type: 'OA' },
        { id: 'a2', name: 'Payroll',         type: 'OA', parentId: 'a1' },
        { id: 'a3', name: 'Contracts',       type: 'OA', parentId: 'a1' },
        { id: 'p1', name: 'alice',           type: 'U',  parentId: 'u2' },
        { id: 'p2', name: 'bob',             type: 'U',  parentId: 'u3' },
        { id: 'p3', name: 'carol',           type: 'U',  parentId: 'u2' },
        { id: 'o1', name: 'employee_001.pdf',type: 'O',  parentId: 'a1' },
        { id: 'o2', name: 'salary_2024.xlsx',type: 'O',  parentId: 'a2' },
        { id: 'o3', name: 'onboarding.pdf',  type: 'O',  parentId: 'a1' },
        { id: 'o4', name: 'nda_alice.pdf',   type: 'O',  parentId: 'a3' },
    ],
    'Finance Policy': [
        { id: 'fu1', name: 'Finance Admins', type: 'UA' },
        { id: 'fu2', name: 'Analysts',       type: 'UA', parentId: 'fu1' },
        { id: 'fu3', name: 'Auditors',       type: 'UA' },
        { id: 'fa1', name: 'Ledger',         type: 'OA' },
        { id: 'fa2', name: 'Q1 Reports',     type: 'OA', parentId: 'fa1' },
        { id: 'fa3', name: 'Q2 Reports',     type: 'OA', parentId: 'fa1' },
        { id: 'fa4', name: 'Tax Filings',    type: 'OA' },
        { id: 'fp1', name: 'dave',           type: 'U',  parentId: 'fu2' },
        { id: 'fp2', name: 'eve',            type: 'U',  parentId: 'fu3' },
        { id: 'fo1', name: 'q1_report.xlsx', type: 'O',  parentId: 'fa2' },
        { id: 'fo2', name: 'q2_report.xlsx', type: 'O',  parentId: 'fa3' },
        { id: 'fo3', name: 'tax_2023.pdf',   type: 'O',  parentId: 'fa4' },
        { id: 'fo4', name: 'budget.xlsx',    type: 'O',  parentId: 'fa1' },
        { id: 'fo5', name: 'audit_log.csv',  type: 'O',  parentId: 'fa1' },
        { id: 'fo6', name: 'tax_2024.pdf',   type: 'O',  parentId: 'fa4' },
    ],
    'IT Policy': [
        { id: 'iu1', name: 'SysAdmins',     type: 'UA' },
        { id: 'iu2', name: 'DevOps',        type: 'UA', parentId: 'iu1' },
        { id: 'iu3', name: 'Developers',    type: 'UA' },
        { id: 'iu4', name: 'QA Engineers',  type: 'UA', parentId: 'iu3' },
        { id: 'iu5', name: 'Security',      type: 'UA' },
        { id: 'ia1', name: 'Servers',       type: 'OA' },
        { id: 'ia2', name: 'Configs',       type: 'OA', parentId: 'ia1' },
        { id: 'ia3', name: 'Logs',          type: 'OA', parentId: 'ia1' },
        { id: 'ip1', name: 'frank',         type: 'U',  parentId: 'iu2' },
        { id: 'ip2', name: 'grace',         type: 'U',  parentId: 'iu4' },
        { id: 'ip3', name: 'henry',         type: 'U',  parentId: 'iu5' },
        { id: 'ip4', name: 'iris',          type: 'U',  parentId: 'iu3' },
        { id: 'ip5', name: 'jack',          type: 'U',  parentId: 'iu2' },
        { id: 'ip6', name: 'kate',          type: 'U',  parentId: 'iu3' },
        { id: 'ip7', name: 'leo',           type: 'U',  parentId: 'iu5' },
        { id: 'ip8', name: 'mia',           type: 'U',  parentId: 'iu4' },
        { id: 'io1', name: 'nginx.conf',    type: 'O',  parentId: 'ia2' },
        { id: 'io2', name: 'access.log',    type: 'O',  parentId: 'ia3' },
    ],
};

export const TYPE_LABELS: Record<string, string> = {
    UA: 'User Attributes',
    OA: 'Object Attributes',
    U: 'Users',
    O: 'Objects',
};

export const TYPE_ORDER = ['UA', 'OA', 'U', 'O'] as const;

/** Sort a flat list so parents appear before their children (within the same list). */
export function sortByHierarchy(nodes: MockNode[]): MockNode[] {
    const result: MockNode[] = [];
    const visited = new Set<string>();
    const ids = new Set(nodes.map(n => n.id));

    function visit(node: MockNode) {
        if (visited.has(node.id)) return;
        visited.add(node.id);
        result.push(node);
        nodes
            .filter(n => n.parentId === node.id)
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(visit);
    }

    nodes
        .filter(n => !n.parentId || !ids.has(n.parentId))
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(visit);

    return result;
}

/** Depth within nodes of the same type (cross-type parent = depth 0). */
export function getDepthInType(nodeId: string, nodes: MockNode[]): number {
    const node = nodes.find(n => n.id === nodeId);
    if (!node?.parentId) return 0;
    const parent = nodes.find(n => n.id === node.parentId);
    if (!parent || parent.type !== node.type) return 0;
    return 1 + getDepthInType(parent.id, nodes);
}

export function getParent(node: MockNode, nodes: MockNode[]): MockNode | undefined {
    return node.parentId ? nodes.find(n => n.id === node.parentId) : undefined;
}

export function getChildren(node: MockNode, nodes: MockNode[]): MockNode[] {
    return nodes.filter(n => n.parentId === node.id);
}
