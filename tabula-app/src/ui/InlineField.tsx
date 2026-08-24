import {
  forwardRef,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

export const InlineInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function InlineInput({ className = "", ...props }, ref) {
  return (
    <input
      {...props}
      ref={ref}
      className={`ui-inline-field ${className}`.trim()}
    />
  );
});

export const InlineTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function InlineTextarea({ className = "", ...props }, ref) {
  return (
    <textarea
      {...props}
      ref={ref}
      className={`ui-inline-field ${className}`.trim()}
    />
  );
});
