"use client";

import { useEffect, useCallback, useState } from "react";
import sdk, {
  AddFrame,
  SignIn as SignInCore,
  type Context,
} from "@farcaster/frame-sdk";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "~/components/ui/card";

import { config } from "~/components/providers/WagmiProvider";
import { truncateAddress } from "~/lib/truncateAddress";
import { base, optimism } from "wagmi/chains";
import { useSession } from "next-auth/react";
import { createStore } from "mipd";
import { Label } from "~/components/ui/label";
import { PROJECT_TITLE } from "~/lib/constants";

function PeanutStats({ userStats }: { userStats: any }) {
  return (
    <Card className="bg-purple-50 border-purple-200">
      <CardHeader>
        <CardTitle className="text-purple-800">🥜 Your Peanut Stats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between">
          <Label className="text-purple-700">Received:</Label>
          <Label className="text-purple-900 font-semibold">{userStats.received}</Label>
        </div>
        <div className="flex justify-between">
          <Label className="text-purple-700">Sent:</Label>
          <Label className="text-purple-900 font-semibold">{userStats.sent}</Label>
        </div>
        <div className="flex justify-between">
          <Label className="text-purple-700">Daily Allowance:</Label>
          <Label className="text-purple-900 font-semibold">
            {DAILY_ALLOWANCE - userStats.sent_today}/{DAILY_ALLOWANCE}
          </Label>
        </div>
        {userStats.failed_attempts > 0 && (
          <div className="text-red-600 text-sm">
            Failed attempts: {userStats.failed_attempts}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Leaderboard({ leaders }: { leaders: Array<any> }) {
  return (
    <Card className="bg-purple-50 border-purple-200">
      <CardHeader>
        <CardTitle className="text-purple-800">🏆 Top Peanutters</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {leaders.map((user, index) => (
            <div key={user.fid} className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-purple-700">{index + 1}.</span>
                <Label className="text-purple-800">{user.username}</Label>
              </div>
              <Label className="text-purple-900 font-semibold">{user.score}</Label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SearchFid() {
  const [searchInput, setSearchInput] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);

  const handleSearch = useCallback(async () => {
    try {
      const response = await fetch(
        `https://api.neynar.com/v2/farcaster/user/search?q=${searchInput}&viewer_fid=${context?.client.fid}`,
        {
          headers: {
            "x-api-key": NEYNAR_API_KEY,
          },
        }
      );
      const data = await response.json();
      setSearchResult(data.result.users[0]);
    } catch (error) {
      console.error("Search failed:", error);
    }
  }, [searchInput]);

  return (
    <Card className="bg-purple-50 border-purple-200">
      <CardHeader>
        <CardTitle className="text-purple-800">🔍 Search FID</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="border-purple-200 rounded px-2 py-1 flex-1"
            placeholder="Enter FID or username"
          />
          <button 
            onClick={handleSearch}
            className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700"
          >
            Search
          </button>
        </div>
        {searchResult && (
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-purple-700">Username:</Label>
              <Label className="text-purple-900 font-semibold">
                {searchResult.username}
              </Label>
            </div>
            <div className="flex justify-between">
              <Label className="text-purple-700">Peanut Score:</Label>
              <Label className="text-purple-900 font-semibold">
                {searchResult.score || 0}
              </Label>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Frame() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();

  const [added, setAdded] = useState(false);

  const [activeView, setActiveView] = useState<"stats" | "leaderboard" | "search">("stats");
  const [userStats, setUserStats] = useState({
    received: 0,
    sent: 0,
    sent_today: 0,
    failed_attempts: 0
  });
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  const addFrame = useCallback(async () => {
    try {
      await sdk.actions.addFrame();
    } catch (error) {
      if (error instanceof AddFrame.RejectedByUser) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      if (error instanceof AddFrame.InvalidDomainManifest) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      setAddFrameResult(`Error: ${error}`);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      const context = await sdk.context;
      if (!context) {
        return;
      }

      setContext(context);
      setAdded(context.client.added);

      // If frame isn't already added, prompt user to add it
      if (!context.client.added) {
        addFrame();
      }

      sdk.on("frameAdded", ({ notificationDetails }) => {
        setAdded(true);
      });

      sdk.on("frameAddRejected", ({ reason }) => {
        console.log("frameAddRejected", reason);
      });

      sdk.on("frameRemoved", () => {
        console.log("frameRemoved");
        setAdded(false);
      });

      sdk.on("notificationsEnabled", ({ notificationDetails }) => {
        console.log("notificationsEnabled", notificationDetails);
      });
      sdk.on("notificationsDisabled", () => {
        console.log("notificationsDisabled");
      });

      sdk.on("primaryButtonClicked", () => {
        console.log("primaryButtonClicked");
      });

      console.log("Calling ready");
      sdk.actions.ready({});

      // Set up a MIPD Store, and request Providers.
      const store = createStore();

      // Subscribe to the MIPD Store.
      store.subscribe((providerDetails) => {
        console.log("PROVIDER DETAILS", providerDetails);
        // => [EIP6963ProviderDetail, EIP6963ProviderDetail, ...]
      });
    };
    if (sdk && !isSDKLoaded) {
      console.log("Calling load");
      setIsSDKLoaded(true);
      load();
      return () => {
        sdk.removeAllListeners();
      };
    }
  }, [isSDKLoaded, addFrame]);

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div
      style={{
        paddingTop: context?.client.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
      }}
    >
      <div className="w-[300px] mx-auto py-2 px-2">
        <h1 className="text-2xl font-bold text-center mb-4 text-gray-700 dark:text-gray-300">
          {PROJECT_TITLE}
        </h1>
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveView("stats")}
            className={`px-4 py-2 rounded ${
              activeView === "stats" 
                ? "bg-purple-600 text-white"
                : "bg-purple-100 text-purple-800"
            }`}
          >
            My Stats
          </button>
          <button
            onClick={() => setActiveView("leaderboard")}
            className={`px-4 py-2 rounded ${
              activeView === "leaderboard"
                ? "bg-purple-600 text-white"
                : "bg-purple-100 text-purple-800"
            }`}
          >
            Leaderboard
          </button>
          <button
            onClick={() => setActiveView("search")}
            className={`px-4 py-2 rounded ${
              activeView === "search"
                ? "bg-purple-600 text-white"
                : "bg-purple-100 text-purple-800"
            }`}
          >
            Search FID
          </button>
        </div>

        {activeView === "stats" && <PeanutStats userStats={userStats} />}
        {activeView === "leaderboard" && <Leaderboard leaders={leaderboard} />}
        {activeView === "search" && <SearchFid />}
      </div>
    </div>
  );
}
