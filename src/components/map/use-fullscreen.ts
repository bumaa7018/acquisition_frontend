import { useCallback, useEffect, useState } from "react";

/**
 * Өгөгдсөн элементийг бүтэн дэлгэц (Fullscreen API) горимд оруулах/гаргах.
 * Гар (Esc) эсвэл өөр аргаар дэлгэцээс гарсан ч төлөв зөв синк хийгдэнэ.
 */
export function useFullscreen(containerRef: React.RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement && document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, [containerRef]);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void containerRef.current?.requestFullscreen();
    }
  }, [containerRef]);

  return { isFullscreen, toggle };
}
