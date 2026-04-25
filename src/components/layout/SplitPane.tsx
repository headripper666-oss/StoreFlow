import { Box } from "@mui/material";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";

interface SplitPaneProps {
  storageKey: string;
  left: React.ReactNode;
  right: React.ReactNode;
  defaultSizes?: [number, number];
  minSize?: number;
}

export function SplitPane({
  storageKey,
  left,
  right,
  defaultSizes = [50, 50],
  minSize = 18,
}: SplitPaneProps) {
  const leftId = `${storageKey}-left`;
  const rightId = `${storageKey}-right`;

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: storageKey,
    panelIds: [leftId, rightId],
    storage: {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
    },
  });

  const resolvedLayout = defaultLayout ?? {
    [leftId]: defaultSizes[0],
    [rightId]: defaultSizes[1],
  };

  return (
    <Group
      orientation="horizontal"
      defaultLayout={resolvedLayout}
      onLayoutChanged={onLayoutChanged}
      style={{ height: "100%", width: "100%" }}
    >
      <Panel id={leftId} minSize={minSize}>
        <Box
          sx={{
            height: "100%",
            overflowY: "auto",
            backgroundColor: "background.default",
          }}
        >
          {left}
        </Box>
      </Panel>

      <Separator>
        <Box
          sx={{
            width: 6,
            height: "100%",
            position: "relative",
            cursor: "col-resize",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            "&:hover .handle-indicator, &:focus-visible .handle-indicator": {
              backgroundColor: "primary.light",
              opacity: 1,
            },
          }}
        >
          <Box
            className="handle-indicator"
            sx={{
              width: 2,
              height: "40px",
              borderRadius: 1,
              backgroundColor: "divider",
              opacity: 0.6,
              transition: "all 0.15s ease",
            }}
          />
        </Box>
      </Separator>

      <Panel id={rightId} minSize={minSize}>
        <Box
          sx={{
            height: "100%",
            overflowY: "auto",
            backgroundColor: "background.default",
            borderLeft: "1px solid",
            borderColor: "divider",
          }}
        >
          {right}
        </Box>
      </Panel>
    </Group>
  );
}
