import React, { createContext, useContext, useState } from 'react';

type Language = 'fr' | 'sw';

const translations = {
  fr: {
    'tab_map': 'Carte',
    'tab_list': 'Liste',
    'tab_profile': 'Profil',
    'tab_sentinel': 'Sentinelle',
    'new_report': 'Nouveau Signalement',
    'report_type': 'Type d\'incident',
    'description': 'Description',
    'send_report': 'Envoyer Signalement',
    'sos_active': 'SOS ACTIVÉ',
    'cancel_send': 'ANNULER',
    'stealth_alert': 'Mode discret activé. Enregistrement en cours...',
    'signal_sent': 'Alerte transmise aux autorités',
    'close_alert': 'Fermer',
    'validate': 'Valider',
    'reject': 'Rejeter',
    'vote_true': 'Confirmer',
    'vote_false': 'Démentir',
    'details_placeholder': 'Décrivez la situation (lieu précis, nombre de personnes...)',
    'details': 'Détails',
    'photo': 'Photo',
    'vocal': 'Audio',
    'video': 'Vidéo',
    'gallery': 'Galerie',
    'gps_pending': 'Acquisition GPS...',
    'VOL': 'Vol',
    'AGRESSION': 'Agression',
    'INCENDIE': 'Incendie',
    'ACCIDENT': 'Accident',
    'ENLEVEMENT': 'Enlèvement',
    'SOS': 'Alerte SOS',
    'AUTRE': 'Autre',
    'VALIDE': 'Validé',
    'REJETE': 'Rejeté',
    'RESOLU': 'Résolu',
    'EN_ATTENTE': 'En attente',
    'notifications': 'Notifications',
    'new': 'Nouveau',
    'mark_all_read': 'Tout lu',
    'no_notif': 'Aucune notification',
    'sentinel_protection': 'Protection Sentinelle',
    'sos_instruction': 'Appuyez 3 fois pour une alerte silencieuse immédiate.',
    'tap_to_stop': 'Appuyer pour arrêter',
    'evidence': 'Preuve',
    'reliability': 'Fiabilité',
    'thanks_vote': 'Vote enregistré',
    'too_far': 'Trop loin pour voter',
  },
  sw: {
    'tab_map': 'Ramani',
    'tab_list': 'Orodha',
    'tab_profile': 'Wasifu',
    'tab_sentinel': 'Mlinzi',
    'new_report': 'Ripoti Mpya',
    'report_type': 'Aina ya Tukio',
    'description': 'Maelezo',
    'send_report': 'Tuma Ripoti',
    'sos_active': 'SOS IMEWASHWA',
    'cancel_send': 'SITISHA',
    'stealth_alert': 'Hali ya siri imewashwa. Inarekodi...',
    'signal_sent': 'Taarifa imetumwa kwa mamlaka',
    'close_alert': 'Funga',
    'validate': 'Thibitisha',
    'reject': 'Kataa',
    'vote_true': 'Ni kweli',
    'vote_false': 'Si kweli',
    'details_placeholder': 'Eleza hali halisi (mahali kamili, idadi ya watu...)',
    'details': 'Maelezo',
    'photo': 'Picha',
    'vocal': 'Sauti',
    'video': 'Video',
    'gallery': 'Matunzio',
    'gps_pending': 'Inatafuta GPS...',
    'VOL': 'Wizi',
    'AGRESSION': 'Shambulio',
    'INCENDIE': 'Moto',
    'ACCIDENT': 'Ajali',
    'ENLEVEMENT': 'Utekeji nyara',
    'SOS': 'Dharura SOS',
    'AUTRE': 'Nyingine',
    'VALIDE': 'Imethibitishwa',
    'REJETE': 'Imekataliwa',
    'RESOLU': 'Imetatuliwa',
    'EN_ATTENTE': 'Inasubiri',
    'notifications': 'Arifa',
    'new': 'Mpya',
    'mark_all_read': 'Soma zote',
    'no_notif': 'Hakuna arifa',
    'sentinel_protection': 'Ulinzi wa Sentinelle',
    'sos_instruction': 'Bonyeza mara 3 kwa dharura ya kimya.',
    'tap_to_stop': 'Bonyeza kusimamisha',
    'evidence': 'Ushahidi',
    'reliability': 'Uaminifu',
    'thanks_vote': 'Kura imepokelewa',
    'too_far': 'Mbali sana kupiga kura',
  }
};

const LanguageContext = createContext<any>(null);

export const LanguageProvider = ({ children }: { children?: React.ReactNode }) => {
  const [language, setLanguage] = useState<Language>('fr');

  const t = (key: string) => {
    return translations[language][key as keyof typeof translations['fr']] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);