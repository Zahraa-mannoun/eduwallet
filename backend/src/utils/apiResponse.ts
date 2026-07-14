export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiError = {
  success: false;
  error: string;
  code: string;
};

export function successResponse<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

export function errorResponse(error: string, code: string): ApiError {
  return { success: false, error, code };
}
