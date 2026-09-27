/** `https://host/base//` → `https://host/base`. Walks back from the end, so its cost is the number of slashes. */
export function withoutTrailingSlashes(value: string): string {
  let end = value.length;

  while (end > 0 && value[end - 1] === "/") {
    end -= 1;
  }

  return value.slice(0, end);
}
