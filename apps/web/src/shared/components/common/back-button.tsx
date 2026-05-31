import { useRouter } from "@tanstack/react-router";
import type { VariantProps } from "class-variance-authority";

import { Button, type buttonVariants } from "@/shared/components/ui/button";

interface BackButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  children?: React.ReactNode;
}

export function BackButton({
  variant = "outline",
  children = "Go Back",
  ...props
}: BackButtonProps) {
  const router = useRouter();

  return (
    <Button variant={variant} onClick={() => router.history.back()} {...props}>
      {children}
    </Button>
  );
}

