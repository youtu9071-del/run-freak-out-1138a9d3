import { Navigate } from "react-router-dom";

// Market is now integrated into the Rewards page as a tab
export default function Market() {
  return <Navigate to="/rewards" replace />;
}
