import { useQuery } from "@tanstack/react-query";
import { getPlayers } from "../lib/api";

export function usePlayers(opts: { search?: string; position?: string; page?: number; limit?: number }) {
    const { search = "", position = "", page = 1, limit = 25} = opts;
    return useQuery({
        queryKey: ["players", { search, position, page, limit }],
        queryFn: () => getPlayers({ search, position, page, limit }),
    });
}