import * as Model from '@/generated/grpc/v1/model';
import { PolicyQueryServiceClientImpl } from '@/generated/grpc/v1/pdp_query';
import * as PdpQuery from '@/generated/grpc/v1/pdp_query';
import { NodeType, PMNode, Association, Prohibition, Obligation, NodePrivilegeInfo } from './pdp.types';
import { rpc, createNodeRef, transformNode, transformAssociation } from './pdp.utils';

function transformProhibition(p: Model.Prohibition): Prohibition {
  return {
    name: p.name,
    subject: p.node ? { node: transformNode(p.node), process: p.process } : undefined,
    accessRights: p.arset,
    isConjunctive: p.isConjunctive,
    inclusionSet: (p.inclusionSet || []).map(transformNode),
    exclusionSet: (p.exclusionSet || []).map(transformNode)
  };
}

const queryClient = new PolicyQueryServiceClientImpl(rpc);

// === Node Queries ===

export async function nodeExists(id: bigint): Promise<boolean> {
  const request = PdpQuery.NodeExistsRequest.create({ node: createNodeRef(id) });
  const response = await queryClient.nodeExists(request);
  return response.exists;
}

export async function getNode(id: bigint): Promise<PMNode> {
  const request = PdpQuery.GetNodeRequest.create({ node: createNodeRef(id) });
  const response = await queryClient.getNode(request);
  return transformNode(response.node!);
}

export async function getNodeId(name: string): Promise<bigint> {
  const request = PdpQuery.GetNodeIdRequest.create({ name });
  const response = await queryClient.getNodeId(request);
  return response.id;
}

export async function searchNodes(type: NodeType, properties?: Record<string, string>): Promise<PMNode[]> {
  const request = PdpQuery.SearchNodesRequest.create({
    type: Model.NodeType[type],
    properties: properties || {}
  });
  const response = await queryClient.searchNodes(request);
  return response.nodes.map(transformNode);
}

// === Graph Queries ===

export async function getPolicyClasses(): Promise<PMNode[]> {
  const request = PdpQuery.GetPolicyClassesRequest.create({});
  const response = await queryClient.getPolicyClasses(request);
  return response.policyClasses.map(transformNode);
}

export async function getAdjacentDescendants(nodeId: bigint): Promise<PMNode[]> {
  const request = PdpQuery.GetAdjacentDescendantsRequest.create({ node: createNodeRef(nodeId) });
  const response = await queryClient.getAdjacentDescendants(request);
  return response.nodes.map(transformNode);
}

export async function getAdjacentAscendants(nodeId: bigint): Promise<PMNode[]> {
  const request = PdpQuery.GetAdjacentAscendantsRequest.create({ node: createNodeRef(nodeId) });
  const response = await queryClient.getAdjacentAscendants(request);
  return response.nodes.map(transformNode);
}

export async function getAscendantSubgraph(nodeId: bigint): Promise<PdpQuery.Subgraph | undefined> {
  const request = PdpQuery.GetAscendantSubgraphRequest.create({ node: createNodeRef(nodeId) });
  const response = await queryClient.getAscendantSubgraph(request);
  return response.subgraph;
}

export async function getDescendantSubgraph(nodeId: bigint): Promise<PdpQuery.Subgraph | undefined> {
  const request = PdpQuery.GetDescendantSubgraphRequest.create({ node: createNodeRef(nodeId) });
  const response = await queryClient.getDescendantSubgraph(request);
  return response.subgraph;
}

export async function getAttributeDescendants(attributeId: bigint): Promise<PMNode[]> {
  const request = PdpQuery.GetAttributeDescendantsRequest.create({ node: createNodeRef(attributeId) });
  const response = await queryClient.getAttributeDescendants(request);
  return response.nodes.map(transformNode);
}

export async function getPolicyClassDescendants(policyClassId: bigint): Promise<PMNode[]> {
  const request = PdpQuery.GetPolicyClassDescendantsRequest.create({ node: createNodeRef(policyClassId) });
  const response = await queryClient.getPolicyClassDescendants(request);
  return response.nodes.map(transformNode);
}

export async function isAscendant(ascendantId: bigint, descendantId: bigint): Promise<boolean> {
  const request = PdpQuery.IsAscendantRequest.create({
    ascendant: createNodeRef(ascendantId),
    descendant: createNodeRef(descendantId)
  });
  const response = await queryClient.isAscendant(request);
  return response.result;
}

export async function isDescendant(descendantId: bigint, ascendantId: bigint): Promise<boolean> {
  const request = PdpQuery.IsDescendantRequest.create({
    descendant: createNodeRef(descendantId),
    ascendant: createNodeRef(ascendantId)
  });
  const response = await queryClient.isDescendant(request);
  return response.result;
}

// === Association Queries ===

export async function getAssociationsWithSource(nodeId: bigint): Promise<Association[]> {
  const request = PdpQuery.GetAssociationsWithSourceRequest.create({ node: createNodeRef(nodeId) });
  const response = await queryClient.getAssociationsWithSource(request);
  return response.associations.map(transformAssociation);
}

export async function getAssociationsWithTarget(nodeId: bigint): Promise<Association[]> {
  const request = PdpQuery.GetAssociationsWithTargetRequest.create({ node: createNodeRef(nodeId) });
  const response = await queryClient.getAssociationsWithTarget(request);
  return response.associations.map(transformAssociation);
}

// === Prohibition Queries ===

export async function getProhibitions(): Promise<Prohibition[]> {
  const request = PdpQuery.GetProhibitionsRequest.create({});
  const response = await queryClient.getProhibitions(request);
  return response.prohibitions.map(transformProhibition);
}

export async function getProhibitionsBySubject(subjectId: bigint): Promise<Prohibition[]> {
  const request = PdpQuery.GetProhibitionsBySubjectRequest.create({ node: createNodeRef(subjectId) });
  const response = await queryClient.getProhibitionsBySubject(request);
  return response.prohibitions.map(transformProhibition);
}

export async function getProhibition(name: string): Promise<Prohibition> {
  const request = PdpQuery.GetProhibitionRequest.create({ name });
  const response = await queryClient.getProhibition(request);
  return transformProhibition(response.prohibition!);
}

export async function getInheritedProhibitions(nodeId: bigint): Promise<Prohibition[]> {
  const request = PdpQuery.GetInheritedProhibitionsRequest.create({ subject: createNodeRef(nodeId) });
  const response = await queryClient.getInheritedProhibitions(request);
  return response.prohibitions.map(transformProhibition);
}

export async function getProhibitionsWithContainer(containerId: bigint): Promise<Prohibition[]> {
  const request = PdpQuery.GetProhibitionsWithContainerRequest.create({ container: createNodeRef(containerId) });
  const response = await queryClient.getProhibitionsWithContainer(request);
  return response.prohibitions.map(transformProhibition);
}

// === Obligation Queries ===

export async function getObligations(): Promise<Obligation[]> {
  const request = PdpQuery.GetObligationsRequest.create({});
  const response = await queryClient.getObligations(request);
  return response.obligations.map(o => ({
    name: o.name,
    author: o.author ? transformNode(o.author) : undefined,
    pml: o.pml
  }));
}

export async function getObligation(name: string): Promise<Obligation> {
  const request = PdpQuery.GetObligationRequest.create({ name });
  const response = await queryClient.getObligation(request);
  const o = response.obligation!;
  return {
    name: o.name,
    author: o.author ? transformNode(o.author) : undefined,
    pml: o.pml
  };
}

export async function getObligationsByAuthor(authorId: bigint): Promise<Obligation[]> {
  const request = PdpQuery.GetObligationsByAuthorRequest.create({ author: createNodeRef(authorId) });
  const response = await queryClient.getObligationsByAuthor(request);
  return response.obligations.map(o => ({
    name: o.name,
    author: o.author ? transformNode(o.author) : undefined,
    pml: o.pml
  }));
}

// === Operation Queries ===

export async function getResourceAccessRights(): Promise<string[]> {
  const request = PdpQuery.GetResourceAccessRightsRequest.create({});
  const response = await queryClient.getResourceAccessRights(request);
  return response.accessRights;
}

export async function getAllOperationSignatures(): Promise<PdpQuery.Signature[]> {
  const request = PdpQuery.GetAllOperationSignaturesRequest.create({});
  const response = await queryClient.getAllOperationSignatures(request);
  return response.signature;
}

export async function getOperationSignature(name: string): Promise<PdpQuery.Signature> {
  const request = PdpQuery.GetOperationSignatureRequest.create({ name });
  const response = await queryClient.getOperationSignature(request);
  return response.signature!;
}

// === Access Control Queries ===

export async function computePrivileges(userId: bigint, targetId: bigint): Promise<string[]> {
  const request = PdpQuery.ComputePrivilegesRequest.create({
    userCtx: PdpQuery.UserContext.create({ id: userId }),
    targetCtx: PdpQuery.TargetContext.create({ id: targetId })
  });
  const response = await queryClient.computePrivileges(request);
  return response.privileges;
}

export async function computeDeniedPrivileges(userId: bigint, targetId: bigint): Promise<string[]> {
  const request = PdpQuery.ComputeDeniedPrivilegesRequest.create({
    userCtx: PdpQuery.UserContext.create({ id: userId }),
    targetCtx: PdpQuery.TargetContext.create({ id: targetId })
  });
  const response = await queryClient.computeDeniedPrivileges(request);
  return response.privileges;
}

export async function computeCapabilityList(userId: bigint): Promise<NodePrivilegeInfo[]> {
  const request = PdpQuery.ComputeCapabilityListRequest.create({
    userCtx: PdpQuery.UserContext.create({ id: userId })
  });
  const response = await queryClient.computeCapabilityList(request);
  return response.nodePrivileges.map((priv: PdpQuery.NodePrivileges) => ({
    node: priv.node ? transformNode(priv.node) : undefined,
    accessRights: priv.arset
  }));
}

export async function computeACL(targetId: bigint): Promise<NodePrivilegeInfo[]> {
  const request = PdpQuery.ComputeACLRequest.create({
    targetCtx: PdpQuery.TargetContext.create({ id: targetId })
  });
  const response = await queryClient.computeACL(request);
  return response.nodePrivileges.map((priv: PdpQuery.NodePrivileges) => ({
    node: priv.node ? transformNode(priv.node) : undefined,
    accessRights: priv.arset
  }));
}

export async function computeDestinationAttributes(userId: bigint): Promise<NodePrivilegeInfo[]> {
  const request = PdpQuery.ComputeDestinationAttributesRequest.create({
    userCtx: PdpQuery.UserContext.create({ id: userId })
  });
  const response = await queryClient.computeDestinationAttributes(request);
  return response.nodePrivileges.map((priv: PdpQuery.NodePrivileges) => ({
    node: priv.node ? transformNode(priv.node) : undefined,
    accessRights: priv.arset
  }));
}

export async function computeSubgraphPrivileges(userId: bigint, rootId: bigint): Promise<PdpQuery.SubgraphPrivileges | undefined> {
  const request = PdpQuery.ComputeSubgraphPrivilegesRequest.create({
    userCtx: PdpQuery.UserContext.create({ id: userId }),
    root: { id: rootId }
  });
  const response = await queryClient.computeSubgraphPrivileges(request);
  return response.subgraphPrivileges;
}

export async function computeAdjacentAscendantPrivileges(userId: bigint, rootId: bigint): Promise<NodePrivilegeInfo[]> {
  const request = PdpQuery.ComputeAdjacentAscendantPrivilegesRequest.create({
    userCtx: PdpQuery.UserContext.create({ id: userId }),
    root: { id: rootId }
  });
  const response = await queryClient.computeAdjacentAscendantPrivileges(request);
  return response.nodePrivileges.map((priv: PdpQuery.NodePrivileges) => ({
    node: priv.node ? transformNode(priv.node) : undefined,
    accessRights: priv.arset
  }));
}

export async function computeAdjacentDescendantPrivileges(userId: bigint, rootId: bigint): Promise<NodePrivilegeInfo[]> {
  const request = PdpQuery.ComputeAdjacentDescendantPrivilegesRequest.create({
    userCtx: PdpQuery.UserContext.create({ id: userId }),
    root: { id: rootId }
  });
  const response = await queryClient.computeAdjacentDescendantPrivileges(request);
  return response.nodePrivileges.map((priv: PdpQuery.NodePrivileges) => ({
    node: priv.node ? transformNode(priv.node) : undefined,
    accessRights: priv.arset
  }));
}

export async function explain(userId: bigint, targetId: bigint): Promise<PdpQuery.ExplainResponse> {
  const request = PdpQuery.ExplainRequest.create({
    userCtx: PdpQuery.UserContext.create({ id: userId }),
    targetCtx: PdpQuery.TargetContext.create({ id: targetId })
  });
  return queryClient.explain(request);
}

export async function computePersonalObjectSystem(userId: bigint): Promise<NodePrivilegeInfo[]> {
  const request = PdpQuery.ComputePersonalObjectSystemRequest.create({
    userCtx: PdpQuery.UserContext.create({ id: userId })
  });
  const response = await queryClient.computePersonalObjectSystem(request);
  return response.nodePrivileges.map((priv: PdpQuery.NodePrivileges) => ({
    node: priv.node ? transformNode(priv.node) : undefined,
    accessRights: priv.arset
  }));
}

// === Self Access Control Queries ===

export async function selfComputePrivileges(targetId: bigint): Promise<string[]> {
  const request = PdpQuery.SelfComputePrivilegesRequest.create({
    targetCtx: PdpQuery.TargetContext.create({ id: targetId })
  });
  const response = await queryClient.selfComputePrivileges(request);
  return response.privileges;
}

export async function selfComputeSubgraphPrivileges(rootId: bigint): Promise<PdpQuery.SubgraphPrivileges | undefined> {
  const request = PdpQuery.SelfComputeSubgraphPrivilegesRequest.create({ root: createNodeRef(rootId) });
  const response = await queryClient.selfComputeSubgraphPrivileges(request);
  return response.subgraphPrivileges;
}

export async function selfComputeAdjacentAscendantPrivileges(rootId: bigint): Promise<NodePrivilegeInfo[]> {
  const request = PdpQuery.SelfComputeAdjacentAscendantPrivilegesRequest.create({ root: createNodeRef(rootId) });
  const response = await queryClient.selfComputeAdjacentAscendantPrivileges(request);
  return response.nodePrivileges.map((priv: PdpQuery.NodePrivileges) => ({
    node: priv.node ? transformNode(priv.node) : undefined,
    accessRights: priv.arset
  }));
}

export async function selfComputeAdjacentDescendantPrivileges(rootId: bigint): Promise<NodePrivilegeInfo[]> {
  const request = PdpQuery.SelfComputeAdjacentDescendantPrivilegesRequest.create({ root: createNodeRef(rootId) });
  const response = await queryClient.selfComputeAdjacentDescendantPrivileges(request);
  return response.nodePrivileges.map((priv: PdpQuery.NodePrivileges) => ({
    node: priv.node ? transformNode(priv.node) : undefined,
    accessRights: priv.arset
  }));
}

export async function selfComputePersonalObjectSystem(): Promise<NodePrivilegeInfo[]> {
  const request = PdpQuery.SelfComputePersonalObjectSystemRequest.create({});
  const response = await queryClient.selfComputePersonalObjectSystem(request);
  return response.nodePrivileges.map((priv: PdpQuery.NodePrivileges) => ({
    node: priv.node ? transformNode(priv.node) : undefined,
    accessRights: priv.arset
  }));
}

// === Serialization ===

export async function serialize(format: Model.SerializationFormat): Promise<string> {
  const request = PdpQuery.SerializeRequest.create({ format });
  const response = await queryClient.serialize(request);
  return response.serialized;
}
