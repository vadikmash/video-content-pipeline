import React from "react";
import { Composition } from "remotion";
import { FactShort } from "./FactShort";
import { FPS, FactShortProps, HEIGHT, WIDTH, defaultProps } from "./props";

export const COMPOSITION_ID = "FactShort";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id={COMPOSITION_ID}
      component={FactShort}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={Math.round(defaultProps.durationSec * FPS)}
      schema={FactShortProps}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(FPS, Math.round(props.durationSec * FPS)),
      })}
    />
  );
};
