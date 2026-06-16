import { grpc } from '@improbable-eng/grpc-web';
import * as Model from '@/generated/grpc/v1/model';
import { getRequestMetadata, grpcConfig, handleGrpcError } from '@/lib/grpc-client';
import { NodeType, PMNode, Association } from './pdp.types';

export function transformNodeType(type: Model.NodeType): NodeType {
  switch (type) {
    case Model.NodeType.PC: return NodeType.PC;
    case Model.NodeType.UA: return NodeType.UA;
    case Model.NodeType.OA: return NodeType.OA;
    case Model.NodeType.U: return NodeType.U;
    case Model.NodeType.O: return NodeType.O;
    case Model.NodeType.ANY: return NodeType.ANY;
    default: return NodeType.ANY;
  }
}

export function transformNode(node: Model.Node): PMNode {
  return {
    id: node.id,
    name: node.name,
    type: transformNodeType(node.type),
    properties: node.properties
  };
}

export function createNodeRef(id: bigint): Model.NodeRef {
  return { id };
}

export function transformAssociation(association: Model.Association): Association {
  return {
    ua: association.ua ? transformNode(association.ua) : undefined,
    target: association.target ? transformNode(association.target) : undefined,
    accessRights: association.arset
  };
}

export function argsToValueMap(args: Record<string, any>): { [key: string]: Model.Value } {
  console.log('[gRPC] argsToValueMap args:', JSON.stringify(args));
  const valueMap: { [key: string]: Model.Value } = {};

  const toModelValue = (value: any): Model.Value | undefined => {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === 'string') {
      return Model.Value.create({ stringValue: value });
    }

    if (typeof value === 'bigint') {
      return Model.Value.create({ int64Value: value });
    }

    if (typeof value === 'number') {
      return Model.Value.create({ int64Value: BigInt(value) });
    }

    if (typeof value === 'boolean') {
      return Model.Value.create({ boolValue: value });
    }

    if (Array.isArray(value)) {
      const convertedItems = value
        .map(item => toModelValue(item))
        .filter((item): item is Model.Value => item !== undefined);

      return Model.Value.create({
        listValue: Model.ValueList.create({ values: convertedItems })
      });
    }

    if (typeof value === 'object') {
      const entries: Record<string, Model.Value> = {};
      for (const [entryKey, entryValue] of Object.entries(value)) {
        const converted = toModelValue(entryValue);
        if (converted !== undefined) {
          entries[String(entryKey)] = converted;
        }
      }

      return Model.Value.create({
        mapValue: Model.ValueMap.create({ values: entries })
      });
    }

    return Model.Value.create({ stringValue: String(value) });
  };

  for (const [key, rawValue] of Object.entries(args)) {
    const converted = toModelValue(rawValue);
    if (converted !== undefined) {
      valueMap[key] = converted;
    }
  }

  return valueMap;
}

class GrpcWebRpc {
  private host: string;
  private transport: grpc.TransportFactory;
  private debug: boolean;
  private timeout: number;

  constructor(host: string, transport: grpc.TransportFactory, debug: boolean = false, timeout: number = 60000) {
    this.host = host;
    this.transport = transport;
    this.debug = debug;
    this.timeout = timeout;
  }

  unary<T extends grpc.UnaryMethodDefinition<any, any>>(
    methodDesc: T,
    _request: any,
    metadata: grpc.Metadata | undefined
  ): Promise<any> {
    const request = { ..._request, ...methodDesc.requestType };
    const combinedMetadata = metadata || getRequestMetadata();

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Request timeout after ${this.timeout}ms`));
      }, this.timeout);

      grpc.unary(methodDesc, {
        request,
        host: this.host,
        metadata: combinedMetadata,
        transport: this.transport,
        debug: this.debug,
        onEnd: (response) => {
          clearTimeout(timeoutId);

          if (this.debug) {
            console.log('[gRPC] Response received:', {
              status: response.status,
              statusMessage: response.statusMessage,
              hasMessage: !!response.message,
              trailers: response.trailers
            });
          }

          if (response.status === grpc.Code.OK) {
            resolve(response.message!.toObject());
          } else {
            reject(handleGrpcError(response.status, response.statusMessage));
          }
        },
      });
    });
  }
}

export const rpc = new GrpcWebRpc(grpcConfig.host, grpcConfig.transport, grpcConfig.debug, grpcConfig.timeout);
