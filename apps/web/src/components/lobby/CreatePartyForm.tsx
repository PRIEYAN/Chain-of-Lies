import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Users } from "lucide-react";

interface CreatePartyFormProps {
  onCreateParty: (name: string) => void;
  isLoading?: boolean;
}

export default function CreatePartyForm({ onCreateParty, isLoading }: CreatePartyFormProps) {
  const [partyName, setPartyName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (partyName.trim()) {
      onCreateParty(partyName.trim());
      setPartyName("");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Create New Party
        </CardTitle>
        <CardDescription>Start your own game lobby</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="party-name">Your Name</Label>
            <Input
              id="party-name"
              placeholder="Enter your name..."
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              disabled={isLoading}
              className="bg-white/5 border-white/10"
            />
          </div>
          <Button
            type="submit"
            disabled={!partyName.trim() || isLoading}
            className="w-full bg-gradient-to-r from-primary to-accent"
          >
            {isLoading ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create Party
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
