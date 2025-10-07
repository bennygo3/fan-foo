import { useQuery } from "@tanstack/react-query";

type Player = { id: string; name: string; position: string; team: string  };

export default function Players() {
    const { data, isLoading, error } = useQuery({
        queryKey: ["players"],
        queryFn: async() => {
            const res = await fetch("/players.json");
            if (!res.ok) throw new Error("Failed to fetch in players .tsx");
            return (await res.json()) as Player[];
        },
        
    });

    if (isLoading) return <p>Loading players...</p>;
    if (error) return <p>Could not load players players tsx</p>;

    return (
        <div>
            <h1>Players</h1>
            <ul>
                {data!.map(p => (
                    <li key={p.id}>{p.name} | {p.position} | {p.team}</li>
                ))}
            </ul>
        </div>
    );
}