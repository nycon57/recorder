import { toast as sonnerToast } from 'sonner';

export interface ToastProps {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

export function useToast() {
  const toast = (props: ToastProps) => {
    const { title, description, variant } = props;
    const message = title || description || '';
    const descriptionText = title && description ? description : undefined;

    if (variant === 'destructive') {
      sonnerToast.error(message, {
        description: descriptionText,
      });
    } else {
      sonnerToast.success(message, {
        description: descriptionText,
      });
    }
  };

  return { toast };
}