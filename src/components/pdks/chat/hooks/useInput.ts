
import { useState } from "react";

export function useInput() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  return {
    input,
    setInput,
    isLoading,
    setIsLoading
  };
}
