import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getNFLPlayers } from "../lib/api";

type SortKey = "name" | "position" | "team" | "proj";

export function useNFLPlayers(opts: {
    season?: string; 
    week?: number | string;
    search?: string; 
    position?: string; 
    teamAbv?: string;
    freeAgents?: boolean; 
    page?: number; 
    limit?: number; 
    sort?: SortKey;
    leagueId?: number;
    staleTime?: number;
}) {
    const {
        season = "2025", 
        week,
        search = "", 
        position = "", 
        teamAbv = "",
        freeAgents = false, 
        page = 1, 
        limit = 40, 
        sort = "proj",
        leagueId,
        staleTime = 60 * 60 * 1000, // need to switch staleTime back if in production vs testing
    } = opts;

    const params = useMemo(() => ({
        season,
        week,
        search: search.trim(),
        position: position.trim().toUpperCase(),
        teamAbv: teamAbv.trim().toUpperCase(),
        freeAgents,
        page,
        limit,
        sort,
        leagueId,
    }),
        [season, week, search, position, teamAbv, freeAgents, page, limit, sort, leagueId]
    );

    return useQuery({
        queryKey: ["nflPlayers", params],      // cache key
        queryFn: () => getNFLPlayers(params),  // fetcher
        placeholderData: keepPreviousData,
        staleTime,
        refetchOnWindowFocus: false,
    });
}