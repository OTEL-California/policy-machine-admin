import { grpc } from '@improbable-eng/grpc-web';
import { AuthService } from './auth';

const GRPC_PROXY_HOST = import.meta.env.PM_ADMIN_GRPC_PROXY_HOST || 'localhost';
const GRPC_PROXY_PORT = import.meta.env.PM_ADMIN_GRPC_PROXY_PORT || '8888';

export const grpcConfig = {
  host: `http://${GRPC_PROXY_HOST}:${GRPC_PROXY_PORT}`,
  transport: grpc.CrossBrowserHttpTransport({ withCredentials: false }),
  debug: import.meta.env.DEV,
  timeout: 60000,
};

export const getRequestMetadata = (): grpc.Metadata => {
  const metadata = new grpc.Metadata();
  const username = AuthService.getUsername();
  if (username) {
    metadata.set('x-pm-user', username);
  }
  const attrs = AuthService.getAttributes();
  if (attrs.length > 0) {
    metadata.set('x-pm-user-attrs', JSON.stringify(attrs));
  }
  return metadata;
};

export const handleGrpcError = (grpcCode: grpc.Code, message: string): Error => {
  console.error(`gRPC Error [${grpcCode}]: ${message}`);
  const error = new Error(message);
  (error as any).cause = { grpcCode, originalMessage: message };
  return error;
}; 