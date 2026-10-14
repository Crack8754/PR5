export const createProjectExample = {
  name: 'StudyFlow',
  description: 'Система керування навчальними проєктами',
  status: 'active',
};

export const projectExample = {
  id: 1,
  ...createProjectExample,
  createdAt: '2026-09-23T10:00:00.000Z',
};

export const updateProjectExample = { status: 'completed' };

export function errorExample(statusCode: number, errorCode: string, message: string, path: string) {
  return {
    statusCode, errorCode, message, path,
    timestamp: '2026-09-23T10:00:00.000Z',
    traceId: '550e8400-e29b-41d4-a716-446655440000',
  };
}
