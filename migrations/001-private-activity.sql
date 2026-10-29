-- LAW only. Apply explicitly to the dedicated database, never during a request/build.
CREATE SCHEMA IF NOT EXISTS law_activity;
REVOKE ALL ON SCHEMA law_activity FROM PUBLIC;
CREATE TABLE IF NOT EXISTS law_activity.events (
 id text PRIMARY KEY, at timestamptz NOT NULL, site text NOT NULL,
 action text NOT NULL, ip_key text NOT NULL, visitor_key text NOT NULL,
 country text NOT NULL, district text NOT NULL, payload text NOT NULL
);
CREATE INDEX IF NOT EXISTS events_site_time ON law_activity.events(site,at DESC,id DESC);
CREATE INDEX IF NOT EXISTS events_time ON law_activity.events(at);
ALTER TABLE law_activity.events ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS law_activity.locations (
 key text NOT NULL, kind text NOT NULL, payload text NOT NULL, expires timestamptz,
 PRIMARY KEY(key,kind)
);
ALTER TABLE law_activity.locations ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS law_activity.limits (
 key text NOT NULL, bucket bigint NOT NULL, count integer NOT NULL,
 PRIMARY KEY(key,bucket)
);
ALTER TABLE law_activity.limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA law_activity FROM PUBLIC;
-- Single atomic statement per allowance; works across serverless instances.
CREATE OR REPLACE FUNCTION law_activity.allow_request(k text,b bigint,maximum integer)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
 INSERT INTO law_activity.limits(key,bucket,count) VALUES(k,b,1)
 ON CONFLICT(key,bucket) DO UPDATE SET count=law_activity.limits.count+1 WHERE law_activity.limits.count<=maximum
 RETURNING count INTO n;
 IF n=1 THEN
  DELETE FROM law_activity.limits WHERE (key,bucket) IN
   (SELECT key,bucket FROM law_activity.limits WHERE bucket<b-86400 LIMIT 20);
 END IF;
 RETURN COALESCE(n<=maximum,false);
END $$;
REVOKE ALL ON FUNCTION law_activity.allow_request(text,bigint,integer) FROM PUBLIC;
