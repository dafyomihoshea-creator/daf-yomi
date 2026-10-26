export type Language = "he" | "en";

export const translations = {
  // Header
  "nav.home": { he: "ראשי", en: "Home" },
  "nav.browse": { he: "עיון", en: "Browse" },
  "nav.calendar": { he: "לוח שיעורים", en: "Calendar" },
  "nav.articles": { he: "מאמרים", en: "Articles" },
  "nav.login": { he: "התחבר", en: "Sign In" },
  "nav.logout": { he: "התנתק", en: "Sign Out" },
  "nav.myLessons": { he: "השיעורים שלי", en: "My Lessons" },
  "nav.playlists": { he: "פלייליסטים", en: "Playlists" },
  "nav.messages": { he: "הודעות", en: "Messages" },
  "nav.stats": { he: "סטטיסטיקות", en: "Statistics" },
  "nav.admin": { he: "ניהול", en: "Admin" },
  "header.title": { he: "הרב הושע רבינוביץ׳", en: "Rabbi Hoshea Rabinowitz" },
  "header.subtitle": { he: "שיעורי תורה", en: "Torah Lessons" },

  // Hero
  "hero.badge": { he: "שיעורי גמרא יומיים", en: "Daily Talmud Classes" },
  "hero.title": { he: "בית המדרש הדיגיטלי", en: "The Digital Beit Midrash" },
  "hero.subtitle": { he: "שיעורי תורה מפי הרב הושע רבינוביץ׳ — לימוד גמרא מסודר לפי מסכת ודף", en: "Torah classes by Rabbi Hoshea Rabinowitz — Organized Talmud study by tractate and page" },

  // Stats
  "stats.lessons": { he: "שיעורים", en: "Lessons" },
  "stats.masechtot": { he: "מסכתות", en: "Tractates" },
  "stats.lessonsIn": { he: "שיעורים ב", en: "Lessons in " },
  
  // Index
  "index.latestLesson": { he: "השיעור האחרון", en: "Latest Lesson" },
  "index.new": { he: "חדש", en: "New" },
  "index.popularMasechtot": { he: "מסכתות פופולריות", en: "Popular Tractates" },
  "index.allMasechtot": { he: "לכל המסכתות", en: "All Tractates" },
  "index.recentLessons": { he: "שיעורים אחרונים", en: "Recent Lessons" },
  "index.searchResults": { he: "תוצאות חיפוש", en: "Search Results" },
  "index.smartSearchResults": { he: "תוצאות חיפוש חכם", en: "Smart Search Results" },
  "index.noLessonsSearch": { he: "לא נמצאו שיעורים. נסה חיפוש אחר.", en: "No lessons found. Try a different search." },
  "index.noLessonsYet": { he: "אין שיעורים עדיין. סנכרן את הערוץ כדי להתחיל.", en: "No lessons yet. Sync the channel to get started." },
  "index.lessonsCalendar": { he: "📅 לוח שיעורים", en: "📅 Lesson Calendar" },
  "index.recommended": { he: "מומלץ עבורך", en: "Recommended for You" },

  // Search
  "search.placeholder": { he: "חפש שיעור...", en: "Search lessons..." },
  "search.smart": { he: "חיפוש חכם", en: "Smart Search" },

  // Email Subscribe
  "subscribe.title": { he: "קבלו עדכונים על שיעורים חדשים", en: "Get Updates on New Lessons" },
  "subscribe.desc": { he: "הירשמו וקבלו התראה כשעולה שיעור חדש", en: "Subscribe and get notified when a new lesson is uploaded" },
  "subscribe.placeholder": { he: "הכנס כתובת מייל", en: "Enter email address" },
  "subscribe.button": { he: "הרשמה", en: "Subscribe" },
  "subscribe.success": { he: "נרשמת בהצלחה!", en: "Successfully subscribed!" },
  "subscribe.already": { he: "כבר נרשמת לעדכונים", en: "Already subscribed" },
  "subscribe.error": { he: "שגיאה בהרשמה, נסה שוב", en: "Error subscribing, try again" },
  "subscribe.invalid": { he: "כתובת מייל לא תקינה", en: "Invalid email address" },
  "subscribe.rss": { he: "הרשמו דרך RSS", en: "Subscribe via RSS" },

  // Browse
  "browse.title": { he: "עיון בשיעורים", en: "Browse Lessons" },
  "browse.filter": { he: "סינון", en: "Filter" },
  "browse.masechet": { he: "מסכת:", en: "Tractate:" },
  "browse.daf": { he: "דף:", en: "Page:" },
  "browse.noLessons": { he: "לא נמצאו שיעורים", en: "No lessons found" },

  // Masechet Filter
  "filter.masechtot": { he: "מסכתות", en: "Tractates" },
  "filter.all": { he: "הכל", en: "All" },
  "filter.dafim": { he: "דפים", en: "Pages" },
  "filter.allPages": { he: "כל הדפים", en: "All Pages" },

  // Login
  "login.title": { he: "התחברות לאתר", en: "Sign In" },
  "login.tab.login": { he: "התחברות", en: "Sign In" },
  "login.tab.register": { he: "הרשמה", en: "Sign Up" },
  "login.email": { he: "אימייל", en: "Email" },
  "login.password": { he: "סיסמה", en: "Password" },
  "login.submit": { he: "התחבר", en: "Sign In" },
  "login.register": { he: "הירשם", en: "Sign Up" },
  "login.success": { he: "התחברת בהצלחה!", en: "Signed in successfully!" },
  "login.error": { he: "שגיאה בהתחברות", en: "Sign in error" },
  "login.registerSuccess": { he: "נרשמת בהצלחה!", en: "Registered successfully!" },
  "login.registerDesc": { he: "בדוק את האימייל שלך לאימות החשבון", en: "Check your email to verify your account" },
  "login.registerError": { he: "שגיאה בהרשמה", en: "Registration error" },

  // My Lessons
  "myLessons.title": { he: "השיעורים שלי", en: "My Lessons" },
  "myLessons.loginPrompt": { he: "התחבר כדי לצפות בשיעורים שלך", en: "Sign in to see your lessons" },
  "myLessons.loginDesc": { he: "שמור שיעורים למועדפים ועקוב אחרי היסטוריית הצפייה שלך", en: "Save lessons to favorites and track your watch history" },
  "myLessons.favorites": { he: "מועדפים", en: "Favorites" },
  "myLessons.history": { he: "היסטוריה", en: "History" },
  "myLessons.noFavorites": { he: "עדיין לא שמרת שיעורים למועדפים", en: "No favorite lessons yet" },
  "myLessons.noHistory": { he: "עדיין לא צפית בשיעורים", en: "No watch history yet" },
  "myLessons.login": { he: "התחברות", en: "Sign In" },

  // Messages
  "messages.title": { he: "ההודעות שלי", en: "My Messages" },
  "messages.loginPrompt": { he: "התחבר כדי לראות את ההודעות שלך", en: "Sign in to see your messages" },
  "messages.noQuestions": { he: "עוד לא שאלת שאלות", en: "No questions yet" },
  "messages.askHint": { he: "אפשר לשאול שאלות מתוך דף השיעור", en: "You can ask questions from the lesson page" },
  "messages.rabbiAnswer": { he: "תשובת הרב", en: "Rabbi's Answer" },
  "messages.waiting": { he: "ממתין לתשובה", en: "Waiting for answer" },

  // Lesson
  "lesson.notFound": { he: "שיעור לא נמצא", en: "Lesson Not Found" },
  "lesson.notFoundDesc": { he: "הדף המבוקש לא קיים", en: "The requested page does not exist" },
  "lesson.backToBrowse": { he: "חזרה לכל השיעורים", en: "Back to All Lessons" },
  "lesson.lessons": { he: "שיעורים", en: "Lessons" },
  "lesson.summary": { he: "תקציר: ", en: "Summary: " },
  "lesson.summaryEdited": { he: "✏️ תקציר זה נערך על ידי המנהל", en: "✏️ This summary was edited by the admin" },
  "lesson.summaryAi": { he: "🤖 תקציר זה נוצר באמצעות בינה מלאכותית", en: "🤖 This summary was generated by AI" },
  "lesson.share": { he: "שתף:", en: "Share:" },
  "lesson.transcript": { he: "תמלול השיעור", en: "Lesson Transcript" },
  "lesson.noTranscript": { he: "אין תמלול זמין לשיעור זה", en: "No transcript available for this lesson" },
  "lesson.transcriptLoading": { he: "טוען תמלול...", en: "Loading transcript..." },
  "lesson.clickToJump": { he: "לחץ על שורה כדי לקפוץ לזמן בשיעור", en: "Click on a line to jump to that time in the video" },
  "lesson.transcriptUnavailable": { he: "התמלול של שיעור זה עדיין לא נוסף לאתר.", en: "The transcript of this lesson has not been added yet." },
  "lesson.transcriptFallbackInstructions": { he: "תוכל לצפות בתמלול המלא ובכתוביות ישירות בנגן הוידאו על ידי לחיצה על כפתור הכתוביות (CC) או פתיחתו ביוטיוב.", en: "You can view the full transcript and captions directly in the video player by clicking the CC button or opening the video on YouTube." },
  "lesson.openOnYoutube": { he: "צפה ותמלל ב-YouTube", en: "Watch & view transcript on YouTube" },

  // Lesson Notes
  "notes.title": { he: "הערות אישיות", en: "Personal Notes" },
  "notes.placeholder": { he: "כתוב כאן את ההערות שלך על השיעור...", en: "Write your notes about this lesson..." },
  "notes.save": { he: "שמור", en: "Save" },
  "notes.saved": { he: "ההערה נשמרה", en: "Note saved" },
  "notes.error": { he: "שגיאה בשמירה", en: "Error saving" },

  // Lesson Questions
  "questions.title": { he: "שאל שאלה על השיעור", en: "Ask a Question" },
  "questions.placeholder": { he: "כתוב את שאלתך כאן...", en: "Write your question here..." },
  "questions.sent": { he: "השאלה נשלחה בהצלחה", en: "Question sent successfully" },
  "questions.sentDesc": { he: "תקבל תשובה בדף ההודעות שלך", en: "You'll receive an answer in your messages" },
  "questions.loginPrompt": { he: "רוצה לשאול שאלה על השיעור?", en: "Want to ask a question about this lesson?" },
  "questions.loginButton": { he: "התחבר כדי לשאול", en: "Sign in to ask" },
  "questions.yourQuestions": { he: "השאלות שלך על שיעור זה:", en: "Your questions on this lesson:" },
  "questions.answersLink": { he: "דף ההודעות", en: "messages page" },
  "questions.answersHint": { he: "התשובות יופיעו ב", en: "Answers will appear on your " },

  // Favorites
  "favorites.added": { he: "נוסף למועדפים ❤️", en: "Added to favorites ❤️" },
  "favorites.removed": { he: "הוסר מהמועדפים", en: "Removed from favorites" },
  "favorites.inFavorites": { he: "במועדפים", en: "In Favorites" },
  "favorites.add": { he: "הוסף למועדפים", en: "Add to Favorites" },

  // Follow Masechet
  "follow.following": { he: "עוקב", en: "Following" },
  "follow.follow": { he: "עקוב", en: "Follow" },
  "follow.stopped": { he: "הפסקת מעקב", en: "Unfollowed" },
  "follow.started": { he: "עוקב אחרי מסכת ", en: "Following tractate " },

  // Playlists
  "playlists.title": { he: "🎵 הפלייליסטים שלי", en: "🎵 My Playlists" },
  "playlists.newName": { he: "שם הפלייליסט החדש...", en: "New playlist name..." },
  "playlists.create": { he: "צור", en: "Create" },
  "playlists.created": { he: "הפלייליסט נוצר בהצלחה", en: "Playlist created" },
  "playlists.deleted": { he: "הפלייליסט נמחק", en: "Playlist deleted" },
  "playlists.createError": { he: "שגיאה ביצירת פלייליסט", en: "Error creating playlist" },
  "playlists.deleteError": { he: "שגיאה במחיקה", en: "Error deleting" },
  "playlists.empty": { he: "אין פלייליסטים עדיין. צור את הראשון!", en: "No playlists yet. Create your first!" },
  "playlists.emptyPlaylist": { he: "הפלייליסט ריק. הוסף שיעורים מדף השיעור.", en: "Playlist is empty. Add lessons from the lesson page." },
  "playlists.back": { he: "← חזרה לרשימה", en: "← Back to list" },
  "playlists.lessons": { he: "שיעורים", en: "lessons" },
  "playlists.addedTo": { he: "נוסף ל-", en: "Added to " },
  "playlists.alreadyIn": { he: "השיעור כבר קיים בפלייליסט", en: "Lesson already in playlist" },

  // Stats
  "statsPage.title": { he: "📊 הסטטיסטיקות שלי", en: "📊 My Statistics" },
  "statsPage.watched": { he: "שיעורים שנצפו", en: "Lessons Watched" },
  "statsPage.masechtot": { he: "מסכתות", en: "Tractates" },
  "statsPage.favorites": { he: "מועדפים", en: "Favorites" },
  "statsPage.streak": { he: "רצף ימים", en: "Day Streak" },
  "statsPage.minutes": { he: "דקות צפייה", en: "Watch Minutes" },
  "statsPage.weeklyActivity": { he: "📈 פעילות שבועית", en: "📈 Weekly Activity" },
  "statsPage.masechetDistribution": { he: "📚 התפלגות לפי מסכת", en: "📚 Distribution by Tractate" },
  "statsPage.recentlyWatched": { he: "נצפו לאחרונה", en: "Recently Watched" },

  // Articles
  "articles.title": { he: "מאמרים וספרים", en: "Articles & Books" },
  "articles.noArticles": { he: "אין מאמרים עדיין", en: "No articles yet" },
  "articles.read": { he: "קריאה", en: "Read" },
  "articles.download": { he: "הורדה", en: "Download" },
  "articles.askQuestion": { he: "שאל שאלה על המאמר", en: "Ask a Question About This Article" },
  "articles.yourQuestions": { he: "השאלות שלך על מאמר זה:", en: "Your questions on this article:" },

  // Calendar
  "calendar.title": { he: "לוח שיעורים", en: "Lesson Calendar" },
  "calendar.noLessons": { he: "אין שיעורים ביום זה", en: "No lessons on this day" },
  "calendar.noSummary": { he: "אין תקציר זמין לשיעור זה", en: "No summary available" },

  // Masechet Page
  "masechetPage.browse": { he: "עיון", en: "Browse" },
  "masechetPage.lessons": { he: "שיעורים", en: "lessons" },
  "masechetPage.pages": { he: "דפים", en: "pages" },
  "masechetPage.jumpToPage": { he: "קפיצה לדף", en: "Jump to Page" },
  "masechetPage.noDefinedPage": { he: "ללא דף מוגדר", en: "No defined page" },
  "masechetPage.noLessons": { he: "אין שיעורים במסכת זו", en: "No lessons in this tractate" },

  // Daf Yomi
  "dafYomi.title": { he: "📖 דף היומי", en: "📖 Daf Yomi" },
  "dafYomi.masechet": { he: "מסכת", en: "Tractate" },
  "dafYomi.page": { he: "דף", en: "Page" },
  "dafYomi.watchLesson": { he: "▶ צפה בשיעור", en: "▶ Watch Lesson" },
  "dafYomi.noLesson": { he: "אין עדיין שיעור לדף זה באתר", en: "No lesson available for this page yet" },

  // Talmud Text
  "talmud.backToLessonPage": { he: "חזרה לדף השיעור", en: "Back to Lesson Page" },
  "talmud.prevPage": { he: "דף קודם", en: "Previous Page" },
  "talmud.nextPage": { he: "דף הבא", en: "Next Page" },
  "talmud.openSefaria": { he: "פתח בספריא", en: "Open in Sefaria" },
  "talmud.loading": { he: "טוען טקסט...", en: "Loading text..." },
  "talmud.notFound": { he: "הדף לא נמצא בספריא", en: "Page not found in Sefaria" },
  "talmud.amudA": { he: "עמוד א׳", en: "Side A" },
  "talmud.amudB": { he: "עמוד ב׳", en: "Side B" },
  "talmud.source": { he: "מקור:", en: "Source:" },
  "talmud.edition": { he: "טקסט מהדורת ויליאם דוידסון", en: "William Davidson Edition" },

  // NotFound
  "notFound.title": { he: "404", en: "404" },
  "notFound.desc": { he: "הדף לא נמצא", en: "Page not found" },
  "notFound.back": { he: "חזרה לעמוד הראשי", en: "Return to Home" },

  // Footer
  "footer.default": { he: "שיעורי הרב הושע רבינוביץ׳", en: "Rabbi Hoshea Rabinowitz Torah Classes" },

  // Common
  "common.error": { he: "שגיאה", en: "Error" },
  "common.masechet": { he: "מסכת", en: "Tractate" },
  "common.daf": { he: "דף", en: "Page" },
} as const;

export type TranslationKey = keyof typeof translations;
