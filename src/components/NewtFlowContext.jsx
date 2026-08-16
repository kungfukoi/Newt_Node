import React from "react";

export const NewtFlowPortContext = React.createContext(false);

export function NewtFlowPortProvider({ children }) {
  return <NewtFlowPortContext.Provider value>{children}</NewtFlowPortContext.Provider>;
}
