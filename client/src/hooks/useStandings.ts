import { useQuery } from "@tanstack/react-query";
import { CURRENT_FANTASY_SEASON } from "../config/fantasy";
import {
    getStandings,
    type StandingsResponse,
} from "../lib/api";

type UseStandingsOptions = {
    leagueId: number,
    season?: number;
    week: number;
};

export function useStandings({
    leagueId,
    season= CURRENT_FANTASY_SEASON,
    week,
}: UseStandingsOptions) {
    return useQuery<StandingsResponse>({
        queryKey: [
            "standings",
            {
                leagueId,
                season,
                week,
            },
        ],

        queryFn: () => 
            getStandings({
                leagueId,
                season,
                week,
            }),

        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
    });
}