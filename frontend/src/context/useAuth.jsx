import { useContext } from "react";
import { userContext } from "./userContext";

export const useAuth = () => {
  return useContext(userContext);
};