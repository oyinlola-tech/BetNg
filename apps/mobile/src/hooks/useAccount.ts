import { useEffect, useState } from "react";
import { getDataSource } from "../services/dataSource";

/* A counter that increments whenever the platform reports an account change; include it in useAsync deps. */
export function useAccountVersion(): number {
  const [version, setVersion] = useState(0);

  useEffect(
    () =>
      getDataSource().subscribeAccount(() => {
        setVersion((v) => v + 1);
      }),
    [],
  );

  return version;
}
