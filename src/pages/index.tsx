import Board from "@/sections/analysis/board";
import PanelHeader from "@/sections/analysis/panelHeader";
import PanelToolBar from "@/sections/analysis/panelToolbar";
import AnalysisTab from "@/sections/analysis/panelBody/analysisTab";
import ClassificationTab from "@/sections/analysis/panelBody/classificationTab";
import CoachTab from "@/sections/analysis/panelBody/coachTab";
import { boardAtom, gameAtom, gameEvalAtom } from "@/sections/analysis/states";
import {
  Box,
  Divider,
  Grid2 as Grid,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Icon } from "@iconify/react";
import EngineSettingsButton from "@/sections/engineSettings/engineSettingsButton";
import GraphTab from "@/sections/analysis/panelBody/graphTab";
import { PageTitle } from "@/components/pageTitle";

export default function GameAnalysis() {
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const [lgPanel, setLgPanel] = useState<"moves" | "coach">("moves");
  const router = useRouter();
  const openedAtPly = typeof router.query.ply === "string";
  const isLgOrGreater = useMediaQuery(theme.breakpoints.up("lg"));

  const gameEval = useAtomValue(gameEvalAtom);
  const game = useAtomValue(gameAtom);
  const board = useAtomValue(boardAtom);

  const showMovesTab = game.history().length > 0 || board.history().length > 0;

  useEffect(() => {
    if (tab === 1 && !showMovesTab) setTab(0);
    if (tab === 2 && !gameEval) setTab(0);
    if (tab === 3 && !gameEval) setTab(0);
  }, [showMovesTab, gameEval, tab]);

  // Links from the trends page land on a specific move: show the coach's take.
  useEffect(() => {
    if (openedAtPly) setLgPanel("coach");
  }, [openedAtPly]);

  return (
    <Grid container gap={4} justifyContent="space-evenly" alignItems="start">
      <PageTitle title="Chess Coach · Analysis" />

      <Board />

      <Grid
        container
        justifyContent="start"
        alignItems="center"
        borderRadius={2}
        border={1}
        borderColor={"secondary.main"}
        sx={{
          backgroundColor: "secondary.main",
          borderColor: "primary.main",
          borderWidth: 2,
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.5)",
        }}
        padding={{ xs: "10px 5px 20px", sm: 2 }}
        style={{
          maxWidth: "1200px",
        }}
        rowGap={2}
        height={{ xs: tab === 1 ? "40rem" : "auto", lg: "calc(95vh - 60px)" }}
        display="flex"
        flexDirection="column"
        flexWrap="nowrap"
        size={{
          xs: 12,
          lg: "grow",
        }}
      >
        {isLgOrGreater ? (
          <Box width="100%">
            <PanelHeader key="analysis-panel-header" />
            <Divider sx={{ marginX: "5%", marginTop: 2.5 }} />
          </Box>
        ) : (
          <PanelToolBar key="review-panel-toolbar" />
        )}

        {!isLgOrGreater && !gameEval && <Divider sx={{ marginX: "5%" }} />}
        {!isLgOrGreater && !gameEval && (
          <PanelHeader key="analysis-panel-header" />
        )}

        {!isLgOrGreater && (
          <Box
            width="95%"
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              marginX: { sm: "5%", xs: undefined },
            }}
          >
            <Tabs
              value={tab}
              onChange={(_, newValue) => setTab(newValue)}
              aria-label="basic tabs example"
              variant="fullWidth"
              sx={{ minHeight: 0 }}
            >
              <Tab
                label="Analysis"
                id="tab0"
                icon={<Icon icon="mdi:magnify" height={15} />}
                iconPosition="start"
                sx={{
                  textTransform: "none",
                  minHeight: 15,
                  padding: "5px 0em 12px",
                }}
                disableFocusRipple
              />

              <Tab
                label="Moves"
                id="tab1"
                icon={<Icon icon="mdi:format-list-bulleted" height={15} />}
                iconPosition="start"
                sx={{
                  textTransform: "none",
                  minHeight: 15,
                  display: showMovesTab ? undefined : "none",
                  padding: "5px 0em 12px",
                }}
                disableFocusRipple
              />

              <Tab
                label="Graph"
                id="tab2"
                icon={<Icon icon="mdi:chart-line" height={15} />}
                iconPosition="start"
                sx={{
                  textTransform: "none",
                  minHeight: 15,
                  display: gameEval ? undefined : "none",
                  padding: "5px 0em 12px",
                }}
                disableFocusRipple
              />

              <Tab
                label="Coach"
                id="tab3"
                icon={<Icon icon="mdi:school-outline" height={15} />}
                iconPosition="start"
                sx={{
                  textTransform: "none",
                  minHeight: 15,
                  display: gameEval ? undefined : "none",
                  padding: "5px 0em 12px",
                }}
                disableFocusRipple
              />
            </Tabs>
          </Box>
        )}

        <GraphTab
          role="tabpanel"
          hidden={tab !== 2 && !isLgOrGreater}
          id="tabContent2"
        />

        <AnalysisTab
          role="tabpanel"
          hidden={tab !== 0 && !isLgOrGreater}
          id="tabContent0"
        />

        {isLgOrGreater && showMovesTab && (
          <ToggleButtonGroup
            exclusive
            size="small"
            value={lgPanel}
            onChange={(_, value) => value && setLgPanel(value)}
            aria-label="Moves or coach"
            sx={{ alignSelf: "center" }}
          >
            <ToggleButton
              value="moves"
              sx={{ textTransform: "none", paddingX: 2 }}
            >
              <Icon
                icon="mdi:format-list-bulleted"
                height={15}
                style={{ marginRight: 6 }}
              />
              Moves
            </ToggleButton>
            <ToggleButton
              value="coach"
              sx={{ textTransform: "none", paddingX: 2 }}
            >
              <Icon
                icon="mdi:school-outline"
                height={15}
                style={{ marginRight: 6 }}
              />
              Coach
            </ToggleButton>
          </ToggleButtonGroup>
        )}

        <ClassificationTab
          role="tabpanel"
          hidden={isLgOrGreater ? lgPanel !== "moves" : tab !== 1}
          id="tabContent1"
        />

        <CoachTab
          role="tabpanel"
          hidden={isLgOrGreater ? lgPanel !== "coach" : tab !== 3}
          id="tabContent3"
        />

        {isLgOrGreater && (
          <Box width="100%">
            <Divider sx={{ marginX: "5%", marginBottom: 1.5 }} />
            <PanelToolBar key="review-panel-toolbar" />
          </Box>
        )}

        {!isLgOrGreater && gameEval && (
          <Box width="100%">
            <Divider sx={{ marginX: "5%", marginBottom: 2.5 }} />
            <PanelHeader key="analysis-panel-header" />
          </Box>
        )}
      </Grid>

      <EngineSettingsButton />
    </Grid>
  );
}
