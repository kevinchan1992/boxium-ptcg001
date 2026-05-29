/**
 * Type override for react-image-crop to fix React 19 compatibility.
 *
 * react-image-crop uses PureComponent which has incompatible types in React 19
 * (missing `context`, `setState`, `forceUpdate`, `props` on the class instance).
 * This module augmentation re-exports ReactCrop as a functional component type
 * so TypeScript is satisfied without changing runtime behaviour.
 */
import type { FC } from "react";
import type { ReactCropProps } from "react-image-crop";

declare module "react-image-crop" {
  const ReactCrop: FC<ReactCropProps>;
  export default ReactCrop;
}
