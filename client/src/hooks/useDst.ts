import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getDSTProjections, type DSTProjection } from "../lib/api";

type DSTParams = {
    season?: string;
    week?: number | string;
    sort?: "proj" | "team";
    teamAbv?: string;
}

type DSTResponse = {
    items: DSTProjection[];
    total?: number;
    week?: number;
    season?: string;
}

export function useDST({ season, week, sort ="proj", teamAbv }: DSTParams) {
    return useQuery<DSTResponse>({
        queryKey: ["dstProjections", { season, week, sort, teamAbv }],
        queryFn: () => getDSTProjections({ season, week, sort, teamAbv }),
        placeholderData: keepPreviousData,
        staleTime: 5 * 60 * 1000, // can switch to 1 minute in the future
        refetchOnWindowFocus: false,
    });
}