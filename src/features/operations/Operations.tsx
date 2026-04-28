import React, { useCallback, useEffect, useMemo, useState } from "react";
import { IconEdit, IconFunction, IconPlus, IconShieldCog, IconTrash, IconX } from "@tabler/icons-react";
import { ActionIcon, Box, Button, Center, Code, Divider, Group, Loader, Modal, NavLink, NumberInput, ScrollArea, Stack, Switch, Text, Textarea, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { AdminOperationIcon } from "@/components/icons/AdminOperationIcon";
import { FunctionIcon } from "@/components/icons/FunctionIcon";
import { QueryOperationIcon } from "@/components/icons/QueryOperationIcon";
import { ResourceOperationIcon } from "@/components/icons/ResourceOperationIcon";
import { RoutineIcon } from "@/components/icons/RoutineIcon";
import { ListDetailPanel } from "@/components/ListDetailPanel";
import { PMLEditor } from "@/features/pml/PMLEditor";
import { Param } from "@/generated/grpc/v1/pdp_query";
import * as AdjudicationService from "@/shared/api/pdp_adjudication.api";
import * as QueryService from "@/shared/api/pdp_query.api";
import { ParamType, OperationType as ProtoOperationType, Signature } from "@/shared/api/pdp.types";


type OperationType = "admin" | "resource" | "query" | "routine" | "function";

interface MapEntryValue {
  key: any;
  value: any;
}

// Helper function to unwrap protobuf Value message
function unwrapValue(value: any): any {
  if (!value || typeof value !== 'object') {
    return value;
  }

  // Check which oneof field is set and return its value
  if (value.stringValue !== undefined && value.stringValue !== null) {
    return value.stringValue;
  }
  if (value.int64Value !== undefined && value.int64Value !== null) {
    return value.int64Value;
  }
  if (value.boolValue !== undefined && value.boolValue !== null) {
    return value.boolValue;
  }
  if (value.listValue !== undefined && value.listValue !== null) {
    // Recursively unwrap list elements
    if (Array.isArray(value.listValue.values)) {
      return value.listValue.values.map(unwrapValue);
    }
    return value.listValue;
  }
  if (value.mapValue !== undefined && value.mapValue !== null) {
    // Recursively unwrap map values
    if (value.mapValue.values && typeof value.mapValue.values === 'object') {
      const unwrapped: Record<string, any> = {};
      for (const [key, val] of Object.entries(value.mapValue.values)) {
        unwrapped[key] = unwrapValue(val);
      }
      return unwrapped;
    }
    return value.mapValue;
  }

  // If no oneof field is set or recognized, return the value as-is
  return value;
}

// Helper function to extract param type from the oneof pattern
function getParamType(param: Param): ParamType | undefined {
  if (param.formalParam?.type) {
    return param.formalParam.type;
  }
  // For nodeId/nodeName params, create synthetic type labels
  if (param.nodeIdFormalParam) {
    return { longType: {} };  // node IDs are longs
  }
  if (param.nodeIdListFormalParam) {
    return { listType: { elementType: { longType: {} } } };
  }
  if (param.nodeNameFormalParam) {
    return { stringType: {} };  // node names are strings
  }
  if (param.nodeNameListFormalParam) {
    return { listType: { elementType: { stringType: {} } } };
  }
  return undefined;
}

function getParamKindLabel(param: Param): string {
  if (param.nodeIdFormalParam) return "Node ID";
  if (param.nodeIdListFormalParam) return "Node ID List";
  if (param.nodeNameFormalParam) return "Node Name";
  if (param.nodeNameListFormalParam) return "Node Name List";
  return formatParamTypeLabel(param.formalParam?.type);
}

interface OperationsProps {
  initialMode?: OperationType;
}

export function Operations({ initialMode = "admin" }: OperationsProps) {
  const [mode, setMode] = useState<OperationType>(initialMode);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");
  const [resourceARModalOpen, setResourceARModalOpen] = useState(false);
  const [resourceAccessRights, setResourceAccessRights] = useState<string[]>([]);
  const [resourceARLoading, setResourceARLoading] = useState(false);
  const [resourceARSaving, setResourceARSaving] = useState(false);
  const [newAccessRight, setNewAccessRight] = useState("");

  // Update mode when initialMode prop changes
  useEffect(() => {
    setMode(initialMode);
    setSelectedOperation(null);
    setIsCreatingNew(false);
  }, [initialMode]);

  const loadSignatures = useCallback(async () => {
    setLoading(true);
    try {
      const all = await QueryService.getAllOperationSignatures();
      const list = all.filter(s => {
        switch (mode) {
          case "admin": return s.operationType === ProtoOperationType.ADMIN;
          case "resource": return s.operationType === ProtoOperationType.RESOURCE;
          case "query": return s.operationType === ProtoOperationType.QUERY;
          case "routine": return s.operationType === ProtoOperationType.ROUTINE;
          case "function": return s.operationType === ProtoOperationType.FUNCTION;
          default: return false;
        }
      });
      setSignatures(list);
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Failed to load signatures",
        message: (error as Error).message,
      });
      setSignatures([]);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    loadSignatures();
  }, [loadSignatures]);

  const getOperationTypeLabel = useCallback((type: OperationType): string => {
    switch (type) {
      case "admin": return "Admin Operations";
      case "resource": return "Resource Operations";
      case "query": return "Queries";
      case "routine": return "Routines";
      case "function": return "Functions";
      default: return "Operations";
    }
  }, []);

  const getOperationIcon = useCallback((type: OperationType, size: number = 16, color?: string) => {
    switch (type) {
      case "admin": return <AdminOperationIcon size={size} color={color} />;
      case "resource": return <ResourceOperationIcon size={size} color={color} />;
      case "query": return <QueryOperationIcon size={size} color={color} />;
      case "routine": return <RoutineIcon size={size} color={color} />;
      case "function": return <FunctionIcon size={size} color={color} />;
      default: return <IconFunction size={size} />;
    }
  }, []);

  const handleCreateNew = useCallback(() => {
    setIsCreatingNew(true);
    setSelectedOperation(null);
  }, []);

  const handleOpenResourceARModal = useCallback(async () => {
    setResourceARModalOpen(true);
    setResourceARLoading(true);
    try {
      const rights = await QueryService.getResourceAccessRights();
      setResourceAccessRights(rights);
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Failed to load resource access rights",
        message: (error as Error).message,
      });
    } finally {
      setResourceARLoading(false);
    }
  }, []);

  const handleAddAccessRight = useCallback(() => {
    const trimmed = newAccessRight.trim();
    if (!trimmed) return;
    if (resourceAccessRights.includes(trimmed)) {
      notifications.show({
        color: "yellow",
        title: "Duplicate",
        message: `"${trimmed}" already exists.`,
      });
      return;
    }
    setResourceAccessRights(prev => [...prev, trimmed]);
    setNewAccessRight("");
  }, [newAccessRight, resourceAccessRights]);

  const handleRemoveAccessRight = useCallback((right: string) => {
    setResourceAccessRights(prev => prev.filter(r => r !== right));
  }, []);

  const handleSaveResourceAccessRights = useCallback(async () => {
    setResourceARSaving(true);
    try {
      await AdjudicationService.setResourceAccessRights(resourceAccessRights);
      notifications.show({
        color: "green",
        title: "Resource Access Rights Updated",
        message: "Resource access rights have been set successfully.",
      });
      setResourceARModalOpen(false);
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Failed to set resource access rights",
        message: (error as Error).message,
      });
    } finally {
      setResourceARSaving(false);
    }
  }, [resourceAccessRights]);

  const handleSelectOperation = useCallback((name: string) => {
    setSelectedOperation(name);
    setIsCreatingNew(false);
  }, []);

  const handleCreateOperation = useCallback(async (pml: string) => {
    // Execute the PML
    await AdjudicationService.executePML(pml);

    // Wait a moment for the backend to process and make the operation available
    await new Promise(resolve => setTimeout(resolve, 500));

    // Reload signatures to include the newly created operation
    await loadSignatures();

    // Reset creation state after successful reload
    setIsCreatingNew(false);

    notifications.show({
      color: 'green',
      title: `${getOperationTypeLabel(mode).slice(0, -1)} Created`,
      message: `${getOperationTypeLabel(mode).slice(0, -1)} has been created successfully`,
    });
  }, [mode, loadSignatures, getOperationTypeLabel]);

  const handleDeleteSuccess = useCallback(() => {
    setSelectedOperation(null);
    loadSignatures();
  }, [loadSignatures]);

  // Filter signatures based on search text
  const filteredSignatures = useMemo(() => {
    if (!filterText.trim()) {
      return signatures;
    }

    const searchText = filterText.toLowerCase();
    return signatures.filter(sig =>
      sig.name?.toLowerCase().includes(searchText)
    );
  }, [signatures, filterText]);

  // Get the currently selected signature object
  const currentSignature = useMemo(() => {
    if (!selectedOperation) return null;
    return signatures.find(s => s.name === selectedOperation) || null;
  }, [signatures, selectedOperation]);

  const headerButtons = mode === "resource" ? (
    <Button
      variant="filled"
      color="var(--mantine-primary-color-filled)"
      onClick={handleOpenResourceARModal}
      leftSection={<IconEdit size={18} />}
    >
      Set Resource Access Rights
    </Button>
  ) : undefined;

  const listContent = (
    <>
      {signatures.length === 0 && !isCreatingNew ? (
        <Box p="md">
          <Text size="sm" c="dimmed">No {getOperationTypeLabel(mode).toLowerCase()} found.</Text>
        </Box>
      ) : null}

      {signatures.length > 0 && filteredSignatures.length === 0 && filterText.trim() ? (
        <Box p="md">
          <Text size="sm" c="dimmed">No matches found.</Text>
        </Box>
      ) : null}

      {filteredSignatures.map((signature) => (
        <NavLink
          key={signature.name}
          label={signature.name || "(unnamed)"}
          leftSection={getOperationIcon(mode)}
          active={selectedOperation === signature.name && !isCreatingNew}
          onClick={() => handleSelectOperation(signature.name || "")}
        />
      ))}
    </>
  );

  const detailContent = isCreatingNew ? (
    <Box style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '0 10px 10px 10px' }}>
      <Group mb="md" justify="space-between">
        <Title order={5}>Create New {getOperationTypeLabel(mode).slice(0, -1)}</Title>
        <Button variant="default" size="xs" onClick={() => setIsCreatingNew(false)}>
          Cancel
        </Button>
      </Group>
      <Box style={{ flex: 1, minHeight: 0 }}>
        <PMLEditor
          onExecute={handleCreateOperation}
          containerHeight="100%"
          autoFocus
        />
      </Box>
    </Box>
  ) : currentSignature ? (
    <Box p="md" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Group mb="md">
        {getOperationIcon(mode, 24)}
        <Title order={5}>{currentSignature.name}</Title>
      </Group>
      <Divider />
      <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <OperationDetails
          signature={currentSignature}
          mode={mode}
          getOperationTypeLabel={getOperationTypeLabel}
          onDelete={handleDeleteSuccess}
        />
      </Box>
    </Box>
  ) : (
    <Center style={{ height: '100%' }}>
      <Stack align="center" gap="xs">
        {getOperationIcon(mode, 48, "grey")}
        <Text c="dimmed" size="sm">Select an operation to view details</Text>
      </Stack>
    </Center>
  );

  return (
    <>
      <ListDetailPanel
        title={getOperationTypeLabel(mode)}
        onCreateClick={handleCreateNew}
        isCreatingNew={isCreatingNew}
        headerButtons={headerButtons}
        filterText={filterText}
        onFilterChange={setFilterText}
        onRefresh={loadSignatures}
        refreshDisabled={loading}
        listContent={listContent}
        detailContent={detailContent}
        loading={loading}
      />

      {/* Resource Access Rights Modal */}
      <Modal
        opened={resourceARModalOpen}
        onClose={() => setResourceARModalOpen(false)}
        title="Resource Access Rights"
        size="lg"
      >
        {resourceARLoading ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : (
          <Stack gap="md">
            <Group>
              <TextInput
                placeholder="New access right name"
                value={newAccessRight}
                onChange={(e) => setNewAccessRight(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddAccessRight();
                }}
                style={{ flex: 1 }}
              />
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={handleAddAccessRight}
                disabled={!newAccessRight.trim()}
              >
                Add
              </Button>
            </Group>

            <Divider />

            {resourceAccessRights.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py="md">
                No resource access rights defined.
              </Text>
            ) : (
              <ScrollArea.Autosize mah={400}>
                <Stack gap={0}>
                  {resourceAccessRights.map((right) => (
                    <Group key={right} justify="space-between" px="xs" py={2}
                           style={{
                             borderBottom: '1px solid var(--mantine-color-gray-2)',
                           }}
                    >
                      <Text size="xs">{right}</Text>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        onClick={() => handleRemoveAccessRight(right)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  ))}
                </Stack>
              </ScrollArea.Autosize>
            )}

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setResourceARModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveResourceAccessRights}
                loading={resourceARSaving}
              >
                Set Access Rights
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}

interface OperationDetailsProps {
  signature: Signature;
  mode: OperationType;
  getOperationTypeLabel: (type: OperationType) => string;
  onDelete: () => void;
}

function OperationDetails({ signature, mode, getOperationTypeLabel, onDelete }: OperationDetailsProps) {
  const [jsonInput, setJsonInput] = useState("{}");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [returnValue, setReturnValue] = useState<any>(null);

  useEffect(() => {
    const defaultValues: Record<string, any> = {};
    for (const param of signature.params ?? []) {
      if (param.name) {
        defaultValues[param.name] = createDefaultValueForParamType(getParamType(param));
      }
    }
    setJsonInput(JSON.stringify(defaultValues, null, 2)); // Pretty print with 2 spaces
    setReturnValue(null); // Clear return value when signature changes
  }, [signature]);


  const handleExecute = async () => {
    if (!signature.name) {
      notifications.show({
        color: "red",
        title: "No operation selected",
        message: "Select an operation before executing.",
      });
      return;
    }

    let parsed: Record<string, any>;
    try {
      parsed = JSON.parse(jsonInput);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Input must be a JSON object');
      }
    } catch (e) {
      notifications.show({
        color: "red",
        title: "Invalid JSON",
        message: e instanceof Error ? e.message : "Failed to parse JSON",
      });
      return;
    }

    const args: Record<string, any> = {};
    for (const param of signature.params ?? []) {
      const value = parsed[param.name];
      const conversion = convertValueForSubmission(
        param.name,
        getParamType(param),
        value,
      );
      if (conversion.error) {
        notifications.show({
          color: "red",
          title: "Invalid parameter value",
          message: conversion.error,
        });
        return;
      }
      if (conversion.include) {
        args[param.name] = conversion.value;
      }
    }

    setSubmitting(true);
    try {
      const response = mode === "resource"
        ? await AdjudicationService.adjudicateResourceOperation(signature.name, args)
        : await AdjudicationService.adjudicateOperation(signature.name, args);

      // Store return value if present, unwrapping the protobuf Value structure
      if (response?.value !== undefined && response?.value !== null) {
        const unwrapped = unwrapValue(response.value);
        setReturnValue(unwrapped);
      } else {
        setReturnValue(null);
      }

      notifications.show({
        color: "green",
        title: "Execution succeeded",
        message: `${mode.charAt(0).toUpperCase() + mode.slice(1)} operation "${signature.name}" executed successfully.`,
      });
    } catch (error) {
      setReturnValue(null);
      notifications.show({
        color: "red",
        title: "Execution failed",
        message: (error as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!signature.name) {
      notifications.show({
        color: "red",
        title: "No operation selected",
        message: "Select an operation before deleting.",
      });
      return;
    }

    setDeleting(true);
    try {
      await AdjudicationService.deleteOperation(signature.name);

      notifications.show({
        color: "green",
        title: "Operation Deleted",
        message: `${getOperationTypeLabel(mode).slice(0, -1)} "${signature.name}" has been deleted successfully.`,
      });

      // Reload the signatures list
      onDelete();
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Delete failed",
        message: (error as Error).message,
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Stack gap="sm" style={{ height: '100%', minHeight: 0 }}>
      {(signature.params?.length ?? 0) > 0 ? (
        <Box style={{ display: 'flex', flexDirection: 'row', height: '100%', gap: 'md' }}>
          <Box style={{height: "100%", width: "30%", display: 'flex', flexDirection: 'column'}}>
            <Title order={6}>Input Schema</Title>
            <Code block style={{ flex: 1, minHeight: 0, whiteSpace: 'pre-wrap' }}>{generatePMLTypeSchemaString(signature.params ?? [])}</Code>
          </Box>
          <Box style={{ backgroundColor: "green", height: "100%", width: "70%"}}>
            <Textarea
              label="Input JSON"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.currentTarget.value)}
              style={{ height: '100%' }}
            />
            <Group mt="mb" justify="flex-end" wrap="wrap">
              <Button
                leftSection={<IconTrash size={16} />}
                onClick={handleDelete}
                loading={deleting}
                disabled={submitting}
                color="red"
                variant="outline"
              >
                Delete
              </Button>
              <Button
                leftSection={<IconFunction size={16} />}
                onClick={handleExecute}
                loading={submitting}
                disabled={deleting}
              >
                Execute
              </Button>
            </Group>
          </Box>
        </Box>
      ) : (
        <Box py="sm">
          <Text size="sm" c="dimmed">
            This {getOperationTypeLabel(mode).toLowerCase().replace(/s$/, '')} has no parameters.
          </Text>
        </Box>
      )}
      {returnValue !== null && returnValue !== undefined && (
        <Box mt="md" p="md" style={{
          border: '1px solid var(--mantine-color-gray-3)',
          borderRadius: '4px',
          backgroundColor: 'var(--mantine-color-gray-0)'
        }}>
          <Title order={6} mb="xs">Return Value</Title>
          <Code block style={{
            maxHeight: '300px',
            overflow: 'auto',
            fontSize: '12px',
            whiteSpace: 'pre-wrap'
          }}>
            {JSON.stringify(returnValue, null, 2)}
          </Code>
        </Box>
      )}
    </Stack>
  );
}

type ParamTypeKind = "string" | "long" | "boolean" | "list" | "map" | "any";

function getParamTypeKind(paramType?: ParamType | null): ParamTypeKind {
  if (paramType?.stringType !== undefined && paramType.stringType !== null) {
    return "string";
  }
  if (paramType?.longType !== undefined && paramType.longType !== null) {
    return "long";
  }
  if (paramType?.booleanType !== undefined && paramType.booleanType !== null) {
    return "boolean";
  }
  if (paramType?.listType !== undefined && paramType.listType !== null) {
    return "list";
  }
  if (paramType?.mapType !== undefined && paramType.mapType !== null) {
    return "map";
  }
  return "any";
}

function formatParamTypeLabel(paramType?: ParamType | null): string {
  const kind = getParamTypeKind(paramType);
  switch (kind) {
    case "string":
      return "string";
    case "long":
      return "number";
    case "boolean":
      return "boolean";
    case "list": {
      const elementType = paramType?.listType?.elementType;
      return `[]${formatParamTypeLabel(elementType)}`;
    }
    case "map": {
      const keyType = paramType?.mapType?.keyType;
      const valueType = paramType?.mapType?.valueType;
      return `map[${formatParamTypeLabel(keyType)}]${formatParamTypeLabel(valueType)}`;
    }
    case "any":
    default:
      return "JSON";
  }
}

function formatPMLType(paramType?: ParamType | null): string {
  const kind = getParamTypeKind(paramType);
  switch (kind) {
    case "string":
      return "string";
    case "long":
      return "long";
    case "boolean":
      return "boolean";
    case "list": {
      const elementType = paramType?.listType?.elementType;
      const elementPML = formatPMLType(elementType);
      return `[]${elementPML}`;
    }
    case "map": {
      const keyType = paramType?.mapType?.keyType;
      const valueType = paramType?.mapType?.valueType;
      const keyPML = formatPMLType(keyType);
      const valuePML = formatPMLType(valueType);
      return `map[${keyPML}]${valuePML}`;
    }
    case "any":
    default:
      return "any";
  }
}

function generatePMLTypeSchemaString(params: Param[]): string {
  const schema: Record<string, string> = {};
  for (const param of params) {
    if (!param.name) {
      continue;
    }
    const paramType = getParamType(param);
    schema[param.name] = formatPMLType(paramType);
  }
  const entries = Object.entries(schema);
  if (entries.length === 0) {
    return '{}';
  }
  let result = '{\n';
  for (const [key, value] of entries) {
    result += `  "${key}": ${value},\n`;
  }
  result = `${result.slice(0, -2)  }\n`; // remove last comma and newline
  result += '}';
  return result;
}

function createDefaultValueForParamType(paramType?: ParamType | null): any {
  const kind = getParamTypeKind(paramType);
  switch (kind) {
    case "string":
      return "";
    case "long":
      return "";
    case "boolean":
      return false;
    case "list":
      return [];
    case "map":
      return [] as MapEntryValue[];
    case "any":
    default:
      return "";
  }
}

function createDefaultMapEntry(mapType?: ParamType["mapType"] | null): MapEntryValue {
  return {
    key: createDefaultValueForParamType(mapType?.keyType ?? undefined),
    value: createDefaultValueForParamType(mapType?.valueType ?? undefined),
  };
}

interface ConversionResult {
  value: any;
  include: boolean;
  error?: string;
}

function convertValueForSubmission(
  paramName: string,
  paramType: ParamType | undefined,
  rawValue: any,
): ConversionResult {
  const kind = getParamTypeKind(paramType);
  switch (kind) {
    case "string": {
      const strValue = typeof rawValue === "string" ? rawValue : "";
      return { value: strValue, include: true };
    }
    case "long": {
      if (rawValue === "" || rawValue === undefined || rawValue === null) {
        return { value: 0, include: true };
      }
      const numericValue = typeof rawValue === "number" ? rawValue : Number(rawValue);
      if (!Number.isFinite(numericValue)) {
        return { value: undefined, include: false, error: `${paramName} must be a valid number.` };
      }
      return { value: Math.trunc(numericValue), include: true };
    }
    case "boolean":
      return { value: Boolean(rawValue), include: true };
    case "list": {
      const items = Array.isArray(rawValue) ? [...rawValue] : [];
      const elementType = paramType?.listType?.elementType;
      const converted: any[] = [];
      for (let i = 0; i < items.length; i += 1) {
        const result = convertValueForSubmission(`${paramName}[${i}]`, elementType, items[i]);
        if (result.error) {
          return { value: undefined, include: false, error: result.error };
        }
        if (result.include) {
          converted.push(result.value);
        }
      }
      return { value: converted, include: true };
    }
    case "map": {
      const entries: MapEntryValue[] = Array.isArray(rawValue)
        ? [...(rawValue as MapEntryValue[])]
        : [];
      const mapType = paramType?.mapType;
      const converted: Record<string, any> = {};
      for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i];
        const keyResult = convertValueForSubmission(
          `${paramName}[${i}].key`,
          mapType?.keyType,
          entry?.key,
        );
        if (keyResult.error) {
          return { value: undefined, include: false, error: keyResult.error };
        }
        if (!keyResult.include || keyResult.value === undefined || keyResult.value === null) {
          return {
            value: undefined,
            include: false,
            error: `${paramName} entry ${i + 1} is missing a key.`,
          };
        }
        if (typeof keyResult.value === "string" && keyResult.value.length === 0) {
          return {
            value: undefined,
            include: false,
            error: `${paramName} entry ${i + 1} is missing a key.`,
          };
        }
        const valueResult = convertValueForSubmission(
          `${paramName}[${i}].value`,
          mapType?.valueType,
          entry?.value,
        );
        if (valueResult.error) {
          return { value: undefined, include: false, error: valueResult.error };
        }
        if (valueResult.include) {
          converted[String(keyResult.value)] = valueResult.value;
        }
      }
      return { value: converted, include: true };
    }
    case "any":
    default: {
      const jsonText = typeof rawValue === "string" ? rawValue.trim() : "";
      if (!jsonText) {
        return { value: {}, include: true };
      }
      try {
        const parsed = JSON.parse(jsonText);
        return { value: parsed, include: true };
      } catch (error) {
        return {
          value: undefined,
          include: false,
          error: `${paramName} must be valid JSON.`,
        };
      }
    }
  }
}
