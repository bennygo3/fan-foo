import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getNFLPlayers } from "../lib/api.ts";

export function useNFLPlayers(opts: {
    season?: string; 
    search?: string; 
    position?: string; 
    teamAbv?: string;
    freeAgents?: boolean; 
    page?: number; 
    limit?: number; 
    staleTime?: number;
}) {
    const {
        season = "2025", search = "", position = "", teamAbv = "",
        freeAgents = false, page = 1, limit = 25, staleTime = 5 * 60 * 1000,
    } = opts;

    const params = useMemo(() => ({
        season,
        search: search.trim(),
        position: position.trim().toUpperCase(),
        teamAbv: teamAbv.trim().toUpperCase(),
        freeAgents,
        page,
        limit,
        sort: "name" as const,
    }),
        [season, search, position, teamAbv, freeAgents, page, limit]
    );

    return useQuery({
        queryKey: ["nflPlayers", params],      // cache key
        queryFn: () => getNFLPlayers(params),  // fetcher
        placeholderData: keepPreviousData,
        staleTime,
        refetchOnWindowFocus: false,
    });
}