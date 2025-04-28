
export function logDebugInfo(info: Record<string, any>) {
  console.log('Debug info:', info);
}

export function formatDebugInfo(data: any) {
  return {
    timestamp: new Date().toISOString(),
    ...data
  };
}
