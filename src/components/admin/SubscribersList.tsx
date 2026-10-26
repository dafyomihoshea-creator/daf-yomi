import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail } from "lucide-react";

export function SubscribersList() {
  const { data: subscribers, isLoading } = useQuery({
    queryKey: ["email_subscribers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_subscribers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2" dir="rtl">
          <Mail className="h-5 w-5 text-accent" />
          נרשמים לעדכוני מייל ({subscribers?.length ?? 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!subscribers || subscribers.length === 0 ? (
          <p className="text-muted-foreground font-body text-sm" dir="rtl">אין נרשמים</p>
        ) : (
          <div className="overflow-auto">
            <Table dir="rtl">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right font-body">מייל</TableHead>
                  <TableHead className="text-right font-body">תאריך הרשמה</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscribers.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-body text-foreground" dir="ltr">{sub.email}</TableCell>
                    <TableCell className="font-body text-muted-foreground text-sm">
                      {new Date(sub.created_at).toLocaleDateString("he-IL")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
