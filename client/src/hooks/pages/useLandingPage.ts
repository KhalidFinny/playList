import { useState, useEffect } from "react";

export function useLandingPage() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading to mask initial animation choppiness
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return { isLoading };
}
