import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface DropZoneProps {
  onFileDrop: (file: File) => Promise<void>;
}

export function DropZone({ onFileDrop }: DropZoneProps) {
  const [isOver, setIsOver] = useState(false);
  const dragDepth = useRef(0);

  useEffect(() => {
    function handleDragEnter(e: DragEvent) {
      if (e.dataTransfer === null || !e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      dragDepth.current += 1;
      if (dragDepth.current === 1) setIsOver(true);
    }

    function handleDragOver(e: DragEvent) {
      if (e.dataTransfer === null || !e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }

    function handleDragLeave(e: DragEvent) {
      if (e.dataTransfer === null || !e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      dragDepth.current -= 1;
      if (dragDepth.current === 0) setIsOver(false);
    }

    function handleDrop(e: DragEvent) {
      e.preventDefault();
      dragDepth.current = 0;
      setIsOver(false);
      const file = e.dataTransfer?.files[0];
      if (file !== undefined) {
        void onFileDrop(file);
      }
    }

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [onFileDrop]);

  if (!isOver) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm"
      style={{ border: '3px dashed hsl(var(--primary))' }}
    >
      <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary bg-background/90 px-16 py-12 shadow-2xl">
        <svg
          className="h-12 w-12 text-primary"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
        <p className="text-xl font-semibold text-foreground">Drop FIX log file here</p>
        <p className="text-sm text-muted-foreground">.log, .txt, .fix or any text file</p>
      </div>
    </div>,
    document.body
  );
}
