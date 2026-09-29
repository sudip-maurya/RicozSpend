/** Turns axios errors into short, user-friendly messages. */

export const getStatusCode = (error) => error?.response?.status ?? null;

/** Field level errors, e.g. { email: "This email is already registered." } */
export const getFieldErrors = (error) => {
  const errors = error?.response?.data?.errors;

  if (!errors || typeof errors !== "object") return {};

  return Object.fromEntries(
    Object.entries(errors).filter(([, message]) => typeof message === "string" && message.trim())
  );
};

export const getErrorMessage = (error, fallback = "Something went wrong. Please try again.") => {
  const message = error?.response?.data?.message;

  if (error?.response) {
    return typeof message === "string" && message.trim() ? message : fallback;
  }

  // No response at all -> the backend is unreachable or the network failed.
  return "Unable to reach the server. Please check your connection and try again.";
};
