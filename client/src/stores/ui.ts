import { create } from "zustand";

export const useUi = create<{ modalOpen: boolean; open:()=>void; close:()=>void }>((set)=>({
    modalOpen: false, open:()=>set({modalOpen:true}), close:()=>set({modalOpen:false})
}));