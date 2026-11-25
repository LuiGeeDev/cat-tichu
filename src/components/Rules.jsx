export default function Rules({ target = 1000 }) {
  const goal = Number(target) || 1000;
  return (
    <div className="rules">
      <section>
        <h3>목표</h3>
        <p>
          4명이 마주 앉은 두 명씩 한 팀이 되어 플레이합니다. 라운드마다 카드 점수를 모아 먼저{' '}
          <b>{goal.toLocaleString()}점</b>에 도달한 팀이 승리합니다. 같은 라운드에 두 팀이 목표점을
          넘으면 점수가 높은 팀이 이깁니다. 목표 점수는 방장이 로비에서 변경할 수 있습니다.
        </p>
      </section>

      <section>
        <h3>카드</h3>
        <p>
          56장 덱을 씁니다. 옥·검·탑·별 4무늬에 2부터 A까지 13개 숫자, 그리고 특수 카드 4장(참새, 개,
          봉황, 용)이 있습니다. 10은 9와 J 사이의 순서입니다.
        </p>
      </section>

      <section>
        <h3>라운드 진행</h3>
        <ol>
          <li>각자 8장을 받고, 그랜드 티츄를 선언할 수 있습니다.</li>
          <li>남은 6장을 받아 14장이 되면, 카드 3장을 골라 왼쪽 상대·파트너·오른쪽 상대에게 한 장씩 건넵니다.</li>
          <li>참새을 가진 사람이 첫 트릭을 시작합니다.</li>
          <li>한 명만 손에 카드가 남을 때까지 진행하고, 점수를 계산합니다.</li>
        </ol>
      </section>

      <section>
        <h3>낼 수 있는 조합</h3>
        <div className="rules__table">
          <div>
            <span>싱글</span>
            <span>카드 1장</span>
          </div>
          <div>
            <span>페어</span>
            <span>같은 숫자 2장</span>
          </div>
          <div>
            <span>트리플</span>
            <span>같은 숫자 3장</span>
          </div>
          <div>
            <span>풀하우스</span>
            <span>트리플 + 페어 (트리플 숫자로 비교)</span>
          </div>
          <div>
            <span>스트레이트</span>
            <span>5장 이상 연속 숫자 (무늬 무관)</span>
          </div>
          <div>
            <span>연속 페어</span>
            <span>2쌍 이상 연속된 페어 (예: 33 44 55)</span>
          </div>
          <div>
            <span>폭탄</span>
            <span>같은 숫자 4장 또는 같은 무늬 5장 이상 연속</span>
          </div>
        </div>
        <p className="hint">
          같은 종류·같은 길이의 더 높은 조합으로만 덮을 수 있습니다. 스트레이트는 길이가 같아야 하고,
          폭탄은 무엇이든 덮습니다.
        </p>
      </section>

      <section>
        <h3>특수 카드</h3>
        <ul className="rules__list">
          <li>
            <b>참새 🐦</b> — 숫자 1로 취급합니다. 스트레이트에 넣을 수 있고(1-2-3-4-5), 낼 때 2~A 중
            한 숫자를 소원할 수 있습니다. 소원을 지킬 수 있는 다음 사람은 반드시 그 숫자가 포함된
            조합을 내야 합니다.
          </li>
          <li>
            <b>개 🐕</b> — 선으로만 낼 수 있습니다. 트릭을 만들지 않고 파트너에게 선을 넘깁니다. 폭탄으로
            막을 수 없습니다.
          </li>
          <li>
            <b>봉황 🔥</b> — 조합 안에서는 2~A 아무 카드나 대신합니다. 싱글로 낼 때는 앞 카드보다 0.5
            높은 값(선일 때는 1.5)이 되어 A도 이기지만 용은 이기지 못합니다. 폭탄에는 쓸 수 없고, -25점입니다.
          </li>
          <li>
            <b>용 🐉</b> — 싱글에서만 낼 수 있는 가장 강한 카드입니다. 이 트릭을 이기면 상대 한 명에게
            트릭을 넘겨야 합니다. +25점입니다.
          </li>
        </ul>
      </section>

      <section>
        <h3>점수</h3>
        <ul className="rules__list">
          <li>5는 5점, 10과 K는 10점, 용은 +25점, 봉황은 -25점입니다. 덱 전체가 정확히 100점입니다.</li>
          <li>
            한 팀의 두 사람이 1등과 2등으로 나가면 <b>더블 승리</b>로 200점을 얻고, 카드 점수는 계산하지
            않습니다.
          </li>
          <li>
            마지막 남은 사람의 손패는 상대 팀에게, 그 사람이 모은 트릭은 1등에게 넘어갑니다.
          </li>
        </ul>
      </section>

      <section>
        <h3>티츄 선언</h3>
        <ul className="rules__list">
          <li>
            <b>티츄</b> — 자신의 첫 카드를 내기 전까지 선언할 수 있습니다. 이번 라운드에서 가장 먼저
            아웃되면 팀이 +100점, 아니면 -100점입니다.
          </li>
          <li>
            <b>그랜드 티츄</b> — 8장을 받은 뒤 9번째 카드를 받기 전에 선언합니다. 성공하면 +200점,
            실패하면 -200점입니다.
          </li>
          <li>티츄는 개인의 약속이라 파트너의 승리는 도움이 되지 않습니다.</li>
        </ul>
      </section>

      <section>
        <h3>참고</h3>
        <p className="hint">
          공식 룰: Fata Morgana «Tichu» (Urs Hostettler) 4인 난징 규칙.{' '}
          <a href="https://fatamorgana.ch/fatamorgana/tichu/english-rules" target="_blank" rel="noreferrer">
            원문 보기
          </a>
          <br />
          온라인 구현상 폭탄은 자신의 차례에만 낼 수 있습니다. 그 외 규칙은 공식 룰을 따릅니다.
        </p>
      </section>
    </div>
  );
}
