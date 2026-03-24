/** Evita chamadas Prisma/Mongo penduradas indefinidamente. */
export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let id: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    id = setTimeout(() => reject(new Error(`${label}: tempo excedido (${ms}ms)`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(id!);
  }
}
