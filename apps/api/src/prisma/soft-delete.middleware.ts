const SOFT_DELETE_MODELS = new Set([
  'User',
  'ExerciseTemplate',
  'WorkoutTemplate',
  'WorkoutSession',
  'SessionExercise',
  'Set',
]);

function withNotDeleted(
  where: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return {
    ...(where ?? {}),
    deletedAt: null,
  };
}

type SoftDeleteParams = {
  model?: string;
  action: string;
  args?: Record<string, unknown>;
};

type SoftDeleteNext = (params: SoftDeleteParams) => Promise<unknown>;

export const softDeleteMiddleware = async (
  params: SoftDeleteParams,
  next: SoftDeleteNext,
) => {
  if (!params.model || !SOFT_DELETE_MODELS.has(params.model)) {
    return next(params);
  }

  switch (params.action) {
    case 'findUnique':
    case 'findFirst':
      params.action = 'findFirst';
      params.args = {
        ...(params.args ?? {}),
        where: withNotDeleted(
          (params.args as { where?: Record<string, unknown> })?.where,
        ),
      };
      break;
    case 'findMany':
      params.args = {
        ...(params.args ?? {}),
        where: withNotDeleted(
          (params.args as { where?: Record<string, unknown> })?.where,
        ),
      };
      break;
    case 'delete':
      params.action = 'update';
      params.args = {
        ...(params.args ?? {}),
        data: {
          deletedAt: new Date(),
          ...(params.args as { data?: Record<string, unknown> })?.data,
        },
      };
      break;
    case 'deleteMany':
      params.action = 'updateMany';
      params.args = {
        ...(params.args ?? {}),
        data: {
          deletedAt: new Date(),
          ...(params.args as { data?: Record<string, unknown> })?.data,
        },
      };
      break;
    default:
      break;
  }

  return next(params);
};
